/**
 * `specgate alm pull` — a board issue arrives as a change, never as a matrix row.
 *
 * ## Why this lives here and not in `scripts/alm/`
 *
 * ADR-0021 makes the board a mirror: nothing under `scripts/alm/` may write the
 * spec tree, and `tests/unit/alm-conformance.test.ts` enforces it by scanning
 * that directory for any write call at all. Inbound work is the one flow that
 * has to produce files, so it is split along the same line the ADR draws:
 *
 *   - the ALM subsystem **reads** the board — `listIssues` on the port;
 *   - the change lifecycle **writes** the proposal and the delta.
 *
 * That keeps the guard at full strength rather than carving an exception into
 * it, and it is the better layering anyway: a connector that can create
 * requirements is precisely what the ADR exists to prevent.
 *
 * ## What it produces, and what it deliberately does not
 *
 * One change per issue, containing a proposal quoting the issue verbatim and a
 * delta whose **scenario is left unwritten**. `change validate` fails while it
 * stays that way, and that is the intended behaviour: a ticket has a title, a
 * description and a status, and no executable acceptance criterion. The empty
 * scenario is the marker for the only work that cannot be automated.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../../../lib/project-root";
import { agentIo, wantsJson, AgentIo } from "../../../lib/agent";
import { error, warning, info } from "../../../lib/diagnostics";
import { readAlmConfig } from "../../../alm/core";
import { makeClient } from "../../../alm/clients";
import type { AlmClient, AlmConfig } from "../../../alm/port";
import { paths, listChangeIds } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import {
  InboundIssue,
  inboundChangeId,
  planInboundChange,
} from "../../../../packages/core/src/domain/InboundChange";

const NULL_SHAPE = { pulled: [], skipped: [] };

/** An issue that became a change. */
interface PulledIssue {
  issue: string;
  change: string;
  requirement: string;
  url: string | null;
}

/** An issue left alone, and why. */
interface SkippedIssue {
  issue: string;
  change: string;
  reason: string;
}

export interface PullOptions {
  projectDir: string;
  label: string;
  json: boolean;
  dryRun: boolean;
}

export function parseArgs(argv: string[]): PullOptions {
  const opts: PullOptions = {
    projectDir: ".",
    label: "spec-driven",
    json: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--label" && argv[i + 1]) opts.label = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

/**
 * The next free requirement id.
 *
 * Read from the matrix rather than reserved through `change new`, because a
 * pull may create several changes in one run and each needs an id nothing else
 * has taken.
 */
function nextRequirementNumber(projectDir: string): number {
  const p = paths(projectDir);
  const matrix = fs.existsSync(p.traceability) ? fs.readFileSync(p.traceability, "utf8") : "";
  let highest = 0;
  for (const m of matrix.matchAll(/REQ-(\d+)/g)) {
    highest = Math.max(highest, Number(m[1]));
  }
  // Changes already on disk hold reservations the matrix has not seen yet.
  for (const id of listChangeIds(projectDir)) {
    const dir = p.change(id);
    for (const file of walk(dir)) {
      for (const m of fs.readFileSync(file, "utf8").matchAll(/REQ-(\d+)/g)) {
        highest = Math.max(highest, Number(m[1]));
      }
    }
  }
  return highest + 1;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(3, "0");

export async function main(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const io: AgentIo = agentIo(opts.json || wantsJson(argv));
  let projectDir: string;
  let cfg: AlmConfig;
  let client: AlmClient;

  try {
    projectDir = resolveProjectDir(opts.projectDir);
    cfg = readAlmConfig(projectDir);
    client = makeClient(cfg, undefined, projectDir);
  } catch (e) {
    return io.fail(NULL_SHAPE, [
      error("alm_pull_error", (e as Error).message || String(e), {
        fix: "Check your ALM configuration.",
      }),
    ]);
  }

  // Declared, not discovered at the first request: Jira searches with JQL,
  // GitHub with query parameters, Azure with WIQL — and a provider that cannot
  // search says so rather than failing halfway through a pull.
  if (!client.capabilities.listIssues || typeof client.listIssues !== "function") {
    return io.fail(NULL_SHAPE, [
      error("alm_pull_unsupported", `Provider '${cfg.provider}' cannot search the board.`, {
        target: cfg.provider,
        fix: "Open the change by hand: specgate propose <id>, then paste the issue into its proposal.",
      }),
    ]);
  }

  const issues: InboundIssue[] = await client.listIssues(opts.label);
  if (issues.length === 0) {
    return io.emit({ pulled: [], skipped: [], label: opts.label }, () =>
      process.stdout.write(`\n  No open issues labelled '${opts.label}'.\n\n`)
    );
  }

  const p = paths(projectDir);
  const existing = new Set(listChangeIds(projectDir));
  const pulled: PulledIssue[] = [];
  const skipped: SkippedIssue[] = [];
  let next = nextRequirementNumber(projectDir);

  for (const issue of issues) {
    const changeId = inboundChangeId(issue.key);
    // A second pull must not duplicate work somebody has started editing.
    if (existing.has(changeId)) {
      skipped.push({ issue: issue.key, change: changeId, reason: "already pulled" });
      continue;
    }

    const reqId = `REQ-${pad(next)}`;
    const scenarioId = `SCN-${pad(next)}`;
    next += 1;
    const plan = planInboundChange(issue, reqId, scenarioId);

    if (!opts.dryRun) {
      const dir = p.change(changeId);
      fs.mkdirSync(path.join(dir, "specs", plan.capability), { recursive: true });
      fs.writeFileSync(path.join(dir, "proposal.md"), plan.proposal, "utf8");
      fs.writeFileSync(path.join(dir, "specs", plan.capability, "spec.md"), plan.delta, "utf8");
      fs.writeFileSync(
        path.join(dir, "change.yaml"),
        [
          "specgate_change_version: 1",
          "schema: spec-driven",
          `created: ${new Date().toISOString().slice(0, 10)}`,
          "rigor: lite",
          "skip_specs: false",
          "retire_capabilities: false",
          `origin: alm:${issue.key}`,
          "",
        ].join("\n"),
        "utf8"
      );
      fs.writeFileSync(
        path.join(dir, "tasks.md"),
        [
          "# Tasks",
          "",
          `## 1. Write the acceptance criterion for ${reqId}`,
          "",
          `- [ ] Replace the TODO scenario in \`specs/${plan.capability}/spec.md\``,
          "- [ ] Confirm the requirement says what the issue meant",
          "",
          "## 2. Validate",
          "",
          `- [ ] \`specgate change validate ${changeId}\``,
          "",
        ].join("\n"),
        "utf8"
      );
    }

    pulled.push({ issue: issue.key, change: changeId, requirement: reqId, url: issue.url });
  }

  const status = [
    info("alm_pull_scenarios_empty", "Every pulled change has an unwritten scenario.", {
      fix: "That is deliberate: a board issue has no executable acceptance criterion. Write it, then `specgate change validate`.",
    }),
  ];
  if (skipped.length > 0) {
    status.push(
      warning("alm_pull_skipped", `${skipped.length} issue(s) already have a change.`, {
        target: skipped[0].change,
        fix: "Delete the change to re-pull it, or edit the one that exists.",
      })
    );
  }

  io.emit({ pulled, skipped, label: opts.label, status }, () => {
    process.stdout.write(`\n  Pulled ${pulled.length} issue(s) labelled '${opts.label}'\n\n`);
    for (const row of pulled) {
      process.stdout.write(`    ${row.issue} → ${row.change}  (${row.requirement})\n`);
    }
    for (const row of skipped) {
      process.stdout.write(`    ${row.issue} — skipped, ${row.reason}\n`);
    }
    process.stdout.write(
      `\n  Each proposal quotes its issue. Each delta has a TODO scenario —\n` +
        `  a ticket carries no acceptance criterion, so that is yours to write.\n\n` +
        `  Next: specgate change status\n\n`
    );
  });
}
