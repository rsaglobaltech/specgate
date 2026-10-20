/**
 * `specgate propose --from-ticket <KEY | issue.json>` — a Jira ticket as the
 * source text of a change (ADR-0039).
 *
 * Reading the ticket is the ALM provider's job and stays read-only; writing
 * the change is this command's, as `alm pull` writes its own outside
 * `scripts/alm/` (ADR-0021 §1).
 */

import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { agentIo } from "../../../lib/agent";
import { error, warning } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { readAlmConfig } from "../../../alm/core";
import { makeClient } from "../../../alm/clients";
import type { AlmConfig } from "../../../alm/port";
import {
  checkTicket,
  readTicket,
  ticketReady,
} from "../../../../packages/core/src/domain/TicketText";
import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";
import type { Ticket } from "../../../../packages/core/src/domain/TicketText";
import { statedValues } from "../../../../packages/core/src/domain/DraftChecklist";
import { templateDelta } from "../../../../packages/core/src/domain/ChangeTemplates";
import { phrases } from "../../../../packages/core/src/infrastructure/DiskLanguageRepository";
import {
  DEFAULT_CONFIG,
  renderConfig,
  reserveReqRange,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { draftReport, nextScenario } from "../spec/DraftCommand";
import { ticketGuide, ticketPrompt } from "../../../draft/ticket-guide";
import { runConfinedAgent, withWritePermission } from "../../../draft/confined-agent";
import { baseFor } from "../../../lib/ticket-keys";

const CHANGES = "docs/specs/changes";
/** The placeholder `templateDelta` writes: a delta nobody has written yet. */
const PLACEHOLDER = "feature=features/<area>/<name>.feature";

export interface TicketOptions {
  ticket: string;
  check: boolean;
  json: boolean;
  projectDir: string;
  capability: string;
  branch: boolean;
  agent: string;
}

const NULL_SHAPE = { ticket: null };
const JIRA_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

function usage(): void {
  process.stdout.write(
    [
      "",
      "  specgate propose --from-ticket <KEY | issue.json> [options]",
      "",
      "  A Jira ticket as the source text of a change (docs/from-a-ticket.md).",
      "",
      "  --check               Its Definition of Ready (T1–T9); writes nothing",
      "  --capability <name>   The capability, when its epic is not under epics:",
      "  --agent <cmd>         Have your agent draft it, confined to the change",
      "  --no-branch           Do not create feature/<KEY>-<slug>",
      "  --project-dir <path>  --json",
      "",
    ].join("\n") + "\n"
  );
}

export function parseTicketArgs(argv: string[]): TicketOptions {
  const opts: TicketOptions = {
    ticket: "",
    check: false,
    json: false,
    projectDir: ".",
    capability: "",
    branch: true,
    agent: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-ticket") opts.ticket = argv[++i] ?? "";
    else if (a === "--check") opts.check = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--project-dir") opts.projectDir = argv[++i] ?? ".";
    else if (a === "--capability") opts.capability = argv[++i] ?? "";
    else if (a === "--no-branch") opts.branch = false;
    else if (a === "--agent") opts.agent = argv[++i] ?? "";
  }
  return opts;
}

/** `alm.config.yaml`, when there is one: a file needs none, a key does. */
function almConfig(projectDir: string): AlmConfig | undefined {
  return fs.existsSync(path.join(projectDir, "alm.config.yaml"))
    ? readAlmConfig(projectDir)
    : undefined;
}

const looksLikeFile = (ref: string) => /\.json$/i.test(ref) || fs.existsSync(ref);

/** The ticket: an exported issue on disk, or the issue read from the board. */
async function loadTicket(ref: string, cfg: AlmConfig | undefined, projectDir: string) {
  const opts = {
    acceptanceField: cfg?.acceptance_field ? String(cfg.acceptance_field) : undefined,
    baseUrl: cfg?.base_url,
  };
  if (looksLikeFile(ref)) {
    const file = path.resolve(ref);
    return readTicket(JSON.parse(fs.readFileSync(file, "utf8")), opts);
  }
  if (!cfg) {
    throw new Error(
      `alm.config.yaml not found in ${projectDir}: reading ${ref} from the board needs it.\n` +
        "Fix: add it (`specgate alm --help`), or export the issue as JSON and pass the file."
    );
  }
  const client = makeClient(cfg, undefined, projectDir);
  if (typeof client.readIssue !== "function") {
    throw new Error(
      `Provider '${cfg.provider}' cannot read one issue.\n` +
        "Fix: export the issue as JSON and pass the file to --from-ticket."
    );
  }
  return readTicket(await client.readIssue(ref), opts);
}

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

const isBug = (t: Ticket) => /^(bug|defect|fehler|incidencia|error)$/i.test(t.type.trim());

/**
 * `feature/KAN-13-register-vehicle-entry`, or `bugfix/…` for a bug: the key is
 * what makes the Git host show the branch in the ticket. Only from a clean
 * tree — carrying someone's uncommitted work onto a ticket's branch would mix
 * it into that ticket.
 */
function ticketBranch(dir: string, t: Ticket): { name: string | null; note: string | null } {
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]).status !== 0) {
    return { name: null, note: null };
  }
  const name = `${isBug(t) ? "bugfix" : "feature"}/${t.key}${changeIdFor(t).slice(t.key.length)}`;
  if (git(dir, ["status", "--porcelain"]).stdout.trim()) {
    return {
      name: null,
      note: `Branch not created: there are uncommitted changes. Commit them, then: git checkout -b ${name}`,
    };
  }
  // From the base, not from wherever HEAD is: another ticket's branch would
  // bring its commits into this ticket's pull request.
  let base: string | null;
  try {
    base = baseFor(dir);
  } catch {
    return {
      name: null,
      note: `Branch ${name} not created: the base branch is not a safe git ref (check --base or SPECGATE_BASE).`,
    };
  }
  const made = git(dir, ["checkout", "-q", "-b", name, ...(base ? [base] : [])]);
  if (made.status !== 0) {
    return { name: null, note: `Branch ${name} not created: ${made.stderr.trim()}` };
  }
  return { name, note: null };
}

function readIf(file: string): string | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

/** `kan-13-register-vehicle-entry`: the key, then the summary's first words. */
export function changeIdFor(t: Ticket): string {
  const slug = t.summary
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  return [t.key.toLowerCase(), slug].filter(Boolean).join("-");
}

/** The capability the ticket's epic maps to, under `epics:` in `alm.config.yaml`. */
function capabilityOf(t: Ticket, cfg: AlmConfig | undefined): string {
  const epics = cfg?.epics;
  if (!t.parent || !epics || typeof epics !== "object") return "";
  const mapped = (epics as Record<string, unknown>)[t.parent];
  return typeof mapped === "string" ? mapped.trim() : "";
}

const sha256 = (text: string) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

/** `ticket.md`: what was read, unedited, and when. */
function ticketCopy(t: Ticket): string {
  const meta = [
    `key=${t.key}`,
    `type=${t.type.replace(/\s+/g, "_") || "issue"}`,
    ...(t.parent ? [`parent=${t.parent}`] : []),
    ...(t.url ? [`url=${t.url}`] : []),
    `read=${new Date().toISOString()}`,
  ].join(" ");
  return [
    `# ${t.key} — ${t.summary}`,
    "",
    `<!-- specgate:ticket ${meta} -->`,
    "",
    ...(t.labels.length ? [`Labels: ${t.labels.join(", ")}`, ""] : []),
    t.description,
    "",
    ...(t.criteria.length && !/acceptance|akzeptanz|aceptaci/i.test(t.description)
      ? ["Acceptance Criteria", "", ...t.criteria.map((c) => `- ${c}`), ""]
      : []),
  ].join("\n");
}

function proposalFor(t: Ticket, changeId: string, capability: string): string {
  return [
    `# Proposal: ${changeId}`,
    "",
    `ticket: ${t.key}`,
    ...(t.url ? [`link: ${t.url}`] : []),
    ...(t.source ? [`source: ${t.source}`] : []),
    "",
    "## Intent",
    "",
    ...(t.intent ? t.intent.split("\n").map((l) => `> ${l}`) : [`> ${t.summary}`]),
    "",
    "## Scope",
    "",
    `In scope: the acceptance criteria of ${t.key}, in the \`${capability}\` capability.`,
    "",
    `Out of scope: anything ${t.key} does not state.`,
    "",
  ].join("\n");
}

function questionsFor(t: Ticket): string | undefined {
  if (t.questions.length === 0) return undefined;
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  return [
    "# Questions",
    "",
    `From ${t.key}'s open questions. The answer is the analyst's assumption until`,
    "someone confirms it.",
    "",
    "| # | Question | Blocks | Answer |",
    "|---|---|---|---|",
    ...t.questions.map(
      (q, i) =>
        `| Q${i + 1} | ${cell(q.text)} |  | ${q.assumption ? `Assumption: ${cell(q.assumption)}` : ""} |`
    ),
    "",
  ].join("\n");
}

/** Write the change: the copy, the proposal, the questions, the guide and the delta. */
function openChange(projectDir: string, t: Ticket, changeId: string, capability: string) {
  const final = path.join(projectDir, CHANGES, changeId);
  // Written aside and moved in one rename: a change folder is either whole
  // or absent, so an interrupted run never leaves one that looks opened.
  const dir = path.join(projectDir, CHANGES, `.${changeId}.opening`);
  fs.rmSync(dir, { recursive: true, force: true });
  try {
    const reqRange = reserveReqRange(projectDir, Math.min(10, Math.max(3, t.criteria.length))) as [
      string,
      string,
    ];
    const copyPath = `${CHANGES}/${changeId}/ticket.md`;
    const copy = ticketCopy(t);
    const created: string[] = [];
    const write = (rel: string, contents: string) => {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents, "utf8");
      created.push(`${CHANGES}/${changeId}/${rel}`);
    };
    const values = [...new Set(t.criteria.flatMap((c) => statedValues(c)))];
    write("ticket.md", copy);
    write("proposal.md", proposalFor(t, changeId, capability));
    const questions = questionsFor(t);
    if (questions) write("questions.md", questions);
    write(
      "DRAFTING.md",
      ticketGuide({
        ticket: t,
        capability,
        changeId,
        copy: copyPath,
        reqRange,
        firstScenario: nextScenario(projectDir),
        values,
      })
    );
    write(
      path.join("specs", capability, "spec.md"),
      templateDelta(capability, reqRange[0], phrases(projectDir))
    );
    const config = {
      ...DEFAULT_CONFIG,
      created: new Date().toISOString().slice(0, 10),
      req_range: reqRange,
    };
    write(
      "change.yaml",
      `${renderConfig(config).trimEnd()}\nbrief: ${copyPath}\nticket: ${t.key}\nticket_sha256: ${sha256(copy)}\n`
    );
    fs.renameSync(dir, final);
    return { reqRange, created };
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

/** The copy without the line that records when it was read. */
const comparable = (copy: string) =>
  copy
    .split("\n")
    .filter((l) => !l.startsWith("<!-- specgate:ticket "))
    .map((l) => l.trimEnd());

/**
 * `ticket_changed`: the ticket on the board is not the one the change was
 * drafted from. The copy stays the record of what was agreed; the person
 * decides whether the change follows.
 */
function changedSince(projectDirOption: string, t: Ticket): Diagnostic[] {
  let projectDir: string;
  try {
    projectDir = resolveProjectDir(projectDirOption);
  } catch {
    return [];
  }
  const copy = readIf(path.join(projectDir, CHANGES, changeIdFor(t), "ticket.md"));
  if (copy === undefined) return [];
  const before = comparable(copy);
  const now = comparable(ticketCopy(t));
  const gone = before.filter((l) => l.trim() && !now.includes(l));
  const added = now.filter((l) => l.trim() && !before.includes(l));
  if (gone.length === 0 && added.length === 0) return [];
  return [
    warning(
      "ticket_changed",
      `${t.key} changed since ${changeIdFor(t)} was opened:\n` +
        [...gone.map((l) => `       - ${l}`), ...added.map((l) => `       + ${l}`)].join("\n"),
      {
        target: t.key,
        fix: "Decide with the analyst whether the change follows; if it does, update the delta and ticket.md together, in one commit naming the ticket.",
      }
    ),
  ];
}

/** `ticket_copy_edited` when `ticket.md` no longer matches the hash taken when it was read. */
function copyIntegrity(dir: string): Diagnostic[] {
  const yaml = readIf(path.join(dir, "change.yaml")) ?? "";
  const recorded = /^ticket_sha256:\s*([0-9a-f]{64})\s*$/m.exec(yaml)?.[1];
  const copy = readIf(path.join(dir, "ticket.md"));
  if (!recorded) return [];
  if (copy !== undefined && sha256(copy) === recorded) return [];
  return [
    error(
      "ticket_copy_edited",
      "ticket.md is not the ticket as it was read: the draft cannot be checked against it.",
      {
        file: "ticket.md",
        fix: "Restore it (git checkout -- ticket.md). If the ticket changed in Jira, run --check to see the difference.",
      }
    ),
  ];
}

function listDeltas(dir: string): string[] {
  const specs = path.join(dir, "specs");
  if (!fs.existsSync(specs)) return [];
  return fs
    .readdirSync(specs)
    .map((cap) => path.join(specs, cap, "spec.md"))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, "utf8"));
}

function ticketJson(t: Ticket) {
  return {
    key: t.key,
    summary: t.summary,
    type: t.type,
    parent: t.parent,
    labels: t.labels,
    url: t.url,
    intent: t.intent,
    source: t.source,
    criteria: t.criteria,
    questions: t.questions,
  };
}

export class TicketCommand extends BaseCommand {
  async execute(): Promise<void> {
    if (this.args.includes("--help") || this.args.includes("-h")) return usage();
    const opts = parseTicketArgs(this.args);
    const io = agentIo(opts.json);
    if (!opts.ticket) {
      io.usage(NULL_SHAPE, [
        error("ticket_missing", "--from-ticket needs a ticket key or an exported issue.", {
          fix: "specgate propose --from-ticket KAN-13 --check, or --from-ticket KAN-13.json",
        }),
      ]);
    }
    let projectDir: string;
    let ticket: Ticket;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
      ticket = await loadTicket(opts.ticket, almConfig(projectDir), projectDir);
    } catch (e) {
      return io.fail(NULL_SHAPE, [error("ticket_unreadable", (e as Error).message)]);
    }
    // The key names the change, the branch and its folder: one that is not a
    // Jira key — an exported file can say anything — would put them anywhere.
    if (!JIRA_KEY.test(ticket.key)) {
      return io.fail(NULL_SHAPE, [
        error("ticket_bad_key", `${JSON.stringify(ticket.key)} is not a Jira issue key.`, {
          fix: 'An issue key is a project key and a number: "KAN-13". Export the issue from Jira again.',
        }),
      ]);
    }
    if (opts.check) return this.check(opts, ticket);
    return this.open(opts, projectDir, ticket);
  }

  /** Open the ticket's change, or report on the one already open. */
  private open(opts: TicketOptions, projectDir: string, ticket: Ticket): void {
    const io = agentIo(opts.json);
    const changeId = changeIdFor(ticket);
    const dir = path.join(projectDir, CHANGES, changeId);
    if (fs.existsSync(dir)) {
      if (opts.agent) return this.withAgent(opts, projectDir, ticket, changeId);
      return this.report(opts, projectDir, ticket, changeId);
    }

    const findings = checkTicket(ticket);
    if (!ticketReady(findings)) {
      io.fail(NULL_SHAPE, [
        error("ticket_not_ready", `${ticket.key} is not ready to draft.`, {
          fix: `Fix what \`specgate propose --from-ticket ${opts.ticket} --check\` reports, in Jira.`,
        }),
        ...findings.filter((d) => d.severity === "error"),
      ]);
    }
    if (!fs.existsSync(path.join(projectDir, "spec.md"))) {
      io.fail(NULL_SHAPE, [
        error("ticket_no_project", "This folder is not a Specgate project yet.", {
          fix: "Run `specgate init` (or `specgate adopt`) first.",
        }),
      ]);
    }
    const capability = opts.capability || capabilityOf(ticket, almConfig(projectDir));
    if (!capability) {
      io.fail(NULL_SHAPE, [
        error(
          "ticket_no_capability",
          `No capability for ${ticket.key}: ${ticket.parent ? `its epic ${ticket.parent} is not mapped` : "it has no epic"}.`,
          {
            fix:
              `Pass --capability <name>, or map the epic in alm.config.yaml:\n` +
              `epics:\n  ${ticket.parent ?? "KAN-5"}: <capability>`,
          }
        ),
      ]);
    }

    const branch = opts.branch ? ticketBranch(projectDir, ticket) : { name: null, note: null };
    const opened = openChange(projectDir, ticket, changeId, capability);
    if (opts.agent) return this.withAgent(opts, projectDir, ticket, changeId, opened.created);
    io.emit(
      {
        ticket: ticketJson(ticket),
        change: changeId,
        capability,
        reserved: opened.reqRange,
        created: opened.created,
        branch: branch.name,
        next: `specgate propose --from-ticket ${opts.ticket}`,
        status: findings,
      },
      () => {
        const out = process.stdout;
        out.write(ui.header("propose --from-ticket", ticket.key));
        out.write(
          ui.ok(
            `Change ${ui.bold(changeId)} opened for ${ticket.key} ` +
              ui.muted(
                `· ${capability} · REQ ids ${opened.reqRange[0]}…${opened.reqRange[1]} reserved`
              )
          ) + "\n"
        );
        for (const f of opened.created) out.write(ui.fileLine("added", f, ""));
        if (branch.name) out.write("\n" + ui.ok(`On branch ${ui.bold(branch.name)}`));
        if (branch.note) out.write("\n" + ui.info(branch.note));
        out.write(
          "\n" +
            ui.section("Have your agent write it") +
            "  Paste this into Claude Code, Cursor, Codex…\n\n"
        );
        out.write(ui.quote(`Draft ${ticket.key}: follow ${CHANGES}/${changeId}/DRAFTING.md`));
        out.write(
          ui.next(
            `specgate propose --from-ticket ${opts.ticket} --agent "claude -p"`,
            `or let Specgate call it — then run specgate propose --from-ticket ${opts.ticket} until it says Ready to review`
          )
        );
      }
    );
  }

  /** Hand the guide to the agent; it may write the change, never the ticket's copy. */
  private withAgent(
    opts: TicketOptions,
    projectDir: string,
    ticket: Ticket,
    changeId: string,
    created: string[] = []
  ): void {
    const io = agentIo(opts.json);
    const guide = readIf(path.join(projectDir, CHANGES, changeId, "DRAFTING.md")) ?? "";
    const agent = withWritePermission(opts.agent);
    const copy = `${CHANGES}/${changeId}/ticket.md`;
    if (!opts.json) {
      process.stdout.write(
        ui.header("propose --from-ticket", ticket.key) +
          (created.length ? ui.ok(`Change ${changeId} opened.`) : "") +
          ui.logLine(`${agent.command} is drafting ${ticket.key}`)
      );
    }
    const run = runConfinedAgent({
      projectDir,
      changeId,
      allowed: (rel) => rel.startsWith(`${CHANGES}/${changeId}/`) && rel !== copy,
      command: agent.command,
      prompt: ticketPrompt(ticket, changeId, guide),
      showOutput: !opts.json,
    });
    if (run.problem === "no_git") {
      io.fail(NULL_SHAPE, [
        error("draft_agent_needs_git", "--agent needs a git repository.", {
          fix: "Run `git init`, or paste the prompt into your agent yourself.",
        }),
      ]);
    }
    if (run.reverted.length > 0 && !opts.json) {
      process.stdout.write(
        "\n" + ui.warn(`Undone — the agent wrote outside the draft: ${run.reverted.join(", ")}`)
      );
    }
    if (!run.ok) {
      io.fail(NULL_SHAPE, [
        error("draft_agent_failed", `The agent ${run.detail}.`, {
          fix: `Check the command runs on its own, or paste this into your agent: Draft ${ticket.key}: follow ${CHANGES}/${changeId}/DRAFTING.md`,
        }),
      ]);
    }
    if (!opts.json) process.stdout.write(ui.rule());
    this.report(opts, projectDir, ticket, changeId, true);
  }

  /** The checklist on the ticket's change, the copy's integrity first. */
  private report(
    opts: TicketOptions,
    projectDir: string,
    ticket: Ticket,
    changeId: string,
    afterAgent = false
  ): void {
    const io = agentIo(opts.json);
    const dir = path.join(projectDir, CHANGES, changeId);
    const integrity = copyIntegrity(dir);
    const deltas = listDeltas(dir);
    const notWritten = deltas.length > 0 && deltas.every((d) => d.includes(PLACEHOLDER));
    const result = notWritten ? undefined : draftReport(projectDir, changeId);
    if (result && "failure" in result) {
      io.fail(NULL_SHAPE, [result.failure]);
      return;
    }
    const report = result?.report;
    const status: Diagnostic[] = [...integrity, ...(report?.status ?? [])];
    const errors = status.filter((d) => d.severity === "error").length;
    const ready = !notWritten && errors === 0;
    const next = ready ? "specgate apply" : `specgate propose --from-ticket ${opts.ticket}`;
    io.emit(
      {
        ticket: ticketJson(ticket),
        change: changeId,
        state: notWritten ? "not written" : ready ? "ready" : "drafting",
        requirements: report?.requirements ?? 0,
        scenarios: report?.scenarios ?? 0,
        next,
        status,
      },
      () => {
        const out = process.stdout;
        out.write(afterAgent ? "\n" : ui.header("propose --from-ticket", ticket.key));
        if (report) {
          out.write(
            `  ${ui.bold(String(report.requirements))} requirement(s) · ${ui.bold(String(report.scenarios))} scenario(s)\n\n`
          );
        }
        writeFindings(status);
        if (notWritten) {
          out.write(
            (status.length ? "\n" : "") +
              "  The draft is still the placeholder. Have your agent write it:\n\n" +
              ui.quote(`Draft ${ticket.key}: follow ${CHANGES}/${changeId}/DRAFTING.md`) +
              ui.next(
                `specgate propose --from-ticket ${opts.ticket} --agent "claude -p"`,
                "or let Specgate call it"
              )
          );
          return;
        }
        out.write(
          "\n" +
            (ready
              ? ui.ok(ui.bold("Ready to review"))
              : ui.fail(
                  `${ui.bold(`${errors} finding(s) to fix`)} ${ui.muted("— each says how; DRAFTING.md has the formats")}`
                ))
        );
        out.write(
          ui.next(
            next,
            ready
              ? `once a person has reviewed ${CHANGES}/${changeId}/ — its requirements, one at a time`
              : "again, until it says Ready to review"
          )
        );
      }
    );
    process.exitCode = ready ? 0 : 1;
  }

  /** `--check`: the ticket's parts, and what keeps it from being drafted. */
  private check(opts: TicketOptions, ticket: Ticket): void {
    const io = agentIo(opts.json);
    const findings = [...checkTicket(ticket), ...changedSince(opts.projectDir, ticket)];
    const errors = findings.filter((d) => d.severity === "error").length;
    const warnings = findings.filter((d) => d.severity === "warning").length;
    const ready = ticketReady(findings);
    const epic = findings.some((d) => d.code === "ticket_epic");
    const next = ready
      ? `specgate propose --from-ticket ${opts.ticket}`
      : epic
        ? "specgate propose --from-ticket <story key> --check"
        : `specgate propose --from-ticket ${opts.ticket} --check`;
    io.emit({ ticket: ticketJson(ticket), ready, errors, warnings, next, status: findings }, () => {
      const out = process.stdout;
      out.write(ui.header("propose --from-ticket --check", ticket.key));
      out.write(
        ui.ok(
          `${ui.bold(ticket.key)} ${ticket.summary} ` +
            ui.muted(
              `· ${ticket.type || "issue"} · ${ticket.criteria.length} criteria · ` +
                `${ticket.questions.length} open question(s)`
            )
        ) + (findings.length ? "\n" : "")
      );
      writeFindings(findings);
      out.write(
        "\n" +
          (ready
            ? ui.ok(
                ui.bold("Ready to draft") +
                  (warnings ? ui.muted(` — ${warnings} warning(s) for you to judge`) : "")
              )
            : ui.fail(
                epic
                  ? ui.bold("An epic is not drafted — its stories are")
                  : `${ui.bold(`${errors} error(s) to fix in Jira before drafting`)} ${ui.muted("— each says how")}`
              ))
      );
      out.write(
        ui.next(
          next,
          ready ? "open the change" : epic ? "one of its stories" : "once the ticket is fixed"
        )
      );
    });
    process.exitCode = ready ? 0 : 1;
  }
}

function writeFindings(findings: readonly Diagnostic[]): void {
  const out = process.stdout;
  for (const d of findings) {
    const where = d.target ? `${ui.bold(d.target)}  ` : "";
    const line = `${ui.muted(d.code)}  ${where}${d.message}`;
    out.write(
      d.severity === "error"
        ? ui.fail(line)
        : d.severity === "warning"
          ? ui.warn(line)
          : ui.info(line)
    );
    if (d.fix) out.write(ui.fix(d.fix));
  }
}
