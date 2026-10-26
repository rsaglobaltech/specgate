import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { AgentIo, agentIo, EXIT } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { UpdateRequirementStatusUseCase } from "../../../../packages/core/src/application/UpdateRequirementStatusUseCase";
import {
  planDoneVerification,
  gateTestCommand,
  deliveryBlocker,
  NO_TEST_COMMAND_WARNING,
} from "../../../../packages/core/src/domain/DoneVerification";
import {
  HarnessSettings,
  readHarnessConfig,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { findCliRoot } from "../../../lib/project-root";
import { isDerivedProject, writeRequirementFields } from "../../../lib/derived-writes";
import { refreshDerivedMatrix } from "./MatrixCommand";
import { inFlightView, InFlightRequirement, InFlightView, DELIVERED } from "../../../lib/in-flight";
import { summarise, nextRequirement, QueueItem } from "./StatusCommand";
import { parseTraceability } from "./PlanCommand";
import type { Diagnostic } from "../../../../packages/core/src/domain/Diagnostic";

import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";
import { deriveRows, setTraceFields } from "../../../../packages/core/src/domain/DerivedMatrix";

import { c } from "../../../lib/ui";
import * as ui from "../../../lib/ui";

/** A row of the generated matrix, as far as `done` reads it. Core returns them untyped. */
interface DerivedRow {
  requirement?: string;
  scenarioId?: string;
  testArtifact?: string;
}

export const ALLOWED_STATUSES = [
  "Draft",
  "Approved",
  "Implemented",
  "Verified",
  "Released",
  "Deprecated",
];

/** Statuses that claim the behaviour exists: `done` gates them by default. */
export const DELIVERED_STATUSES = ["Implemented", "Verified", "Released"];

/**
 * Statuses that owe a test under TDD-1: past Draft, and not Deprecated.
 * Approved is one of them, so writing it before a test names the requirement
 * turned the next `validate --strict` red for the whole project (REQ-173).
 */
export const OWES_TEST_STATUSES = ["Approved", ...DELIVERED_STATUSES];

export interface DoneOptions {
  reqId: string | null;
  /** Every id given: `done REQ-002 REQ-003` closes both with one run of the suite (#77). */
  reqIds: string[];
  status: string;
  projectDir: string;
  check: boolean;
  strict: boolean;
  /** `--no-check`: write the status without running the gate first. */
  noCheck?: boolean;
  /** Overrides `test_cmd:` in harness.config.yaml for this invocation. */
  testCmd?: string;
  json?: boolean;
}

export function parseArgs(argv: string[]): DoneOptions {
  const opts: DoneOptions = {
    reqId: null,
    reqIds: [],
    status: "Implemented",
    projectDir: ".",
    check: false,
    strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--status" && argv[i + 1]) opts.status = argv[++i];
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--check") opts.check = true;
    else if (a === "--no-check") opts.noCheck = true;
    else if (a === "--test-cmd" && argv[i + 1]) opts.testCmd = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--strict") {
      opts.strict = true;
      opts.check = true;
    } else if (!a.startsWith("-")) {
      if (!opts.reqId) opts.reqId = a;
      opts.reqIds.push(a);
    }
  }
  // A status that claims delivery runs the gate unless told not to. `done`
  // used to print a tick over a scenario of unfilled <placeholder> steps and
  // no test, and the next `check` — the one in CI — failed: the daily loop's
  // last verb said yes to what its fourth said no to.
  if (!opts.noCheck && DELIVERED_STATUSES.includes(opts.status)) {
    opts.check = true;
    opts.strict = true;
  }
  return opts;
}

export class DoneCommand extends BaseCommand {
  /** `apply` is the daily name, `done` the one scripts know (ADR-0035): same command. */
  private verb: "done" | "apply";

  constructor(args: string[] = [], verb: "done" | "apply" = "done") {
    super(args);
    this.verb = verb;
  }

  public execute(): void {
    const opts = parseArgs(this.args);
    // Annotated so that `io.fail`, which never returns, narrows what follows it.
    const io: AgentIo = agentIo(Boolean(opts.json));
    const NULL_SHAPE = { requirement: null };
    const verb = this.verb;

    // Before the required-argument check: `done --help` used to answer
    // "REQ-id is required", which is a usage error in response to a question.
    if (this.args.includes("--help") || this.args.includes("-h")) {
      process.stdout.write(
        (verb === "done"
          ? "Same as specgate apply: deliver a requirement through the gate.\n\n"
          : "Deliver one requirement: its test first, then the gate marks it Implemented.\n\n") +
          "Usage:\n" +
          `  specgate ${verb} [<REQ-id> …] [--status <Status>] [--no-check]\n` +
          '                       [--test-cmd "<command>"] [--project-dir <path>] [--json]\n\n' +
          "Without an id, takes the next requirement `specgate status` names. Refused\n" +
          "while no test names the requirement. Marks it delivered when the gate\n" +
          "`specgate check` runs passes for it; nothing is written when it fails. A\n" +
          "requirement of an open change is judged as it will be after archive, and\n" +
          "its status is written in the change's delta. Several ids are checked one by\n" +
          "one and the project's tests run once for all of them.\n\n" +
          "Options:\n" +
          `  --status <Status>   Target status (default: Implemented).\n` +
          `                      One of: ${ALLOWED_STATUSES.join(", ")}\n` +
          "  --no-check          Write the status without running the gate (Implemented,\n" +
          "                      Verified and Released run it by default).\n" +
          "  --check, --strict   Run the gate for any status, Approved included.\n" +
          '  --test-cmd "<cmd>"  Also run the project\'s tests and require them to pass.\n' +
          "                      Read from `test_cmd:` in harness.config.yaml when omitted.\n" +
          `                      Without one, \`${verb}\` says it checked the specification\n` +
          "                      and not the code, rather than reporting a pass.\n" +
          "  --project-dir <p>   Project root (auto-detected from cwd if omitted).\n" +
          "  --json              Emit one JSON document on stdout.\n"
      );
      process.exit(EXIT.OK);
    }

    // Any word used to be written as the status: `--status Aproved` too (REQ-173).
    if (!ALLOWED_STATUSES.includes(opts.status)) {
      io.usage(NULL_SHAPE, [
        error("status_unknown", `Unknown status: ${opts.status}.`, {
          target: opts.status,
          fix: `Use one of: ${ALLOWED_STATUSES.join(", ")}.`,
        }),
      ]);
    }

    if (opts.reqIds.length > 1) return this.executeMany(opts, io);
    if (opts.reqId && !/^REQ-\d+$/.test(opts.reqId)) {
      io.usage(NULL_SHAPE, [
        error("req_id_malformed", `Invalid REQ-id: ${opts.reqId} (expected REQ-NNN).`, {
          target: opts.reqId,
          fix: "Use the REQ-NNN form, e.g. REQ-007.",
        }),
      ]);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      // `resolveProjectDir` throws Errors.
      io.usage(NULL_SHAPE, [
        error("project_not_found", (err as Error).message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }

    // ── The project the gate judges ──────────────────────────────────────────
    //
    // A requirement of an open change lives only in its delta until archive
    // (ADR-0035): the gate judges the project as it will be after archive.
    // A test written since the last regeneration is new evidence: bring a
    // generated matrix up to date before checking it, or the gate would refuse
    // the very test that makes the requirement deliverable.
    refreshDerivedMatrix(projectDir);
    const view = inFlightView(projectDir);
    const dir = view ? view.dir : projectDir;
    const toProject = (t: string) => (view ? view.toProject(t) : t);
    const queue = () => summarise(dir, readTrace(dir), projectDir);

    // No id: the next requirement `status` names.
    if (!opts.reqId) {
      const next = fs.existsSync(path.join(dir, TRACE)) ? nextRequirement(queue().items) : null;
      if (!next) {
        io.fail(NULL_SHAPE, [
          error("nothing_to_apply", "No requirement is waiting to be delivered.", {
            fix: "specgate propose <change-id>",
          }),
        ]);
      }
      opts.reqId = next.requirement;
      opts.reqIds = [next.requirement];
    }
    const id = opts.reqId!;
    const owner = view ? view.requirements.find((r) => r.id === id) : undefined;
    const gated = opts.check && DELIVERED_STATUSES.includes(opts.status);

    // A change whose delta cannot be laid over the project cannot be judged.
    const broken = owner && view ? view.problems.filter((d) => d.change === owner.change) : [];
    if (broken.length > 0) {
      io.fail(NULL_SHAPE, [
        ...broken.map(({ fix: _fix, change: _change, ...d }) => d),
        error("change_invalid", `${id}'s change '${owner!.change}' does not validate.`, {
          target: owner!.change,
          fix: `specgate change validate ${owner!.change}`,
        }),
      ]);
    }

    if (!opts.json) process.stdout.write(ui.header(`${verb} ${id}`, opts.status));

    // Before the suite: a requirement waiting for an answer is refused in a
    // second, with the reason, instead of after the slowest step (#72).
    if (gated) {
      const tracePath = path.join(dir, TRACE);
      const blocker = fs.existsSync(tracePath)
        ? deliveryBlocker(fs.readFileSync(tracePath, "utf8"), id)
        : null;
      if (blocker) {
        io.fail(NULL_SHAPE, [
          error(blocker.code, `not marked ${opts.status}: ${blocker.message}`, {
            target: id,
            fix: blocker.fix,
          }),
        ]);
      }
    }

    // Test first (ADR-0035): a test that names the requirement — or a `test=`
    // in its trace — is its link, and without one there is nothing to judge.
    // Said before the gate, with the fix, rather than as TDD-1 among everything
    // validate finds. Approved owes it too (REQ-173): TDD-1 judges every status
    // past Draft, so writing it first only moved the refusal to the next check.
    const owesTest = !opts.noCheck && OWES_TEST_STATUSES.includes(opts.status);
    if (owesTest) {
      const missing = missingTest(dir, id);
      if (missing) {
        io.fail(NULL_SHAPE, [
          error("apply_no_test", `${id} has no test that names it yet (TDD-1).`, {
            target: id,
            fix: noTestFix(verb, id, opts.status, missing.scenario),
          }),
        ]);
      }
    }

    // ── The checks, before anything is written ───────────────────────────────
    //
    // `--check` and `--strict` used to be parsed and discarded, so `done
    // REQ-001 --check` printed a tick over a matrix pointing at files that do
    // not exist. Four documentation pages said it "validates first".
    const harness: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    const plan = planDoneVerification(dir, {
      check: opts.check,
      strict: opts.strict,
      reqId: id,
      testCmd: opts.testCmd || harness.testCmd,
      archCmd: harness.archCmd,
    });

    for (const step of plan.steps) {
      const exec = () =>
        step.stage === "validate"
          ? spawnSync(
              process.execPath,
              [
                path.join(findCliRoot(__dirname), "bin", "specgate.js"),
                "validate",
                ...step.argv,
                ...(opts.json ? ["--json"] : []),
              ],
              { encoding: "utf8" }
            )
          : spawnSync(step.argv[0], {
              cwd: projectDir,
              encoding: "utf8",
              shell: true,
            });
      const label =
        step.stage === "validate"
          ? `Specification   ${ui.muted(`the gate, for ${id}`)}`
          : step.stage === "arch"
            ? `Architecture    ${ui.muted(step.argv[0])}`
            : `Tests           ${ui.muted(step.argv[0])}`;
      const run = opts.json ? exec() : ui.task(label, exec, (r) => ({ ok: r.status === 0 }));

      if (run.status === 0) continue;

      // The output is the evidence, and it goes out *before* the diagnostic:
      // `io.fail` never returns, so anything written after it is dead code.
      const detail = toProject(`${run.stdout || ""}${run.stderr || ""}`.trim());
      if (detail && !opts.json) process.stderr.write("\n" + indent(detail) + "\n\n");

      // Over JSON (and so over MCP) the reason has to travel in the document:
      // the agent got `done_validate_failed` and nothing it could act on.
      let findings: Array<Omit<Diagnostic, "fix">> = [];
      if (opts.json && step.stage === "validate") {
        try {
          const stdout = toProject(String(run.stdout));
          const doc: { status?: Diagnostic[] } = JSON.parse(stdout.slice(stdout.indexOf("{")));
          // One fix line per refusal: the findings say what, the last says how.
          findings = (doc.status || [])
            .filter((d) => d.severity === "error")
            .map(({ fix: _fix, ...d }) => d);
        } catch {
          // Not JSON: the diagnostic below still says it failed.
        }
      }

      const again = `specgate ${verb} ${id}`;
      io.fail(NULL_SHAPE, [
        ...findings,
        error(
          step.stage === "validate"
            ? "done_validate_failed"
            : step.stage === "arch"
              ? "done_arch_failed"
              : "done_tests_failed",
          step.stage === "validate"
            ? `not marked ${opts.status}: validation failed.`
            : step.stage === "arch"
              ? `not marked ${opts.status}: the architecture check failed.`
              : `not marked ${opts.status}: the project's tests failed.`,
          {
            target: id,
            fix:
              step.stage === "validate"
                ? `fix what validate reports above, then run ${again}`
                : step.stage === "arch"
                  ? `make \`${step.argv[0]}\` pass — the code where the architecture expects it — then run ${again}`
                  : `make \`${step.argv[0]}\` pass, then run ${again}`,
          }
        ),
      ]);
    }

    const result = writeStatus(projectDir, dir, owner, id, opts.status);
    if (result.ok) warnUntested(opts, dir, id);
    if (!result.ok) {
      if (result.code === "traceability_not_found") {
        io.usage(NULL_SHAPE, [
          error("traceability_not_found", result.error || "traceability.md not found", {
            file: "docs/specs/traceability.md",
            fix: "Scaffold it with `specgate init`, or adopt the project with `specgate adopt`.",
          }),
        ]);
      } else {
        io.fail(NULL_SHAPE, [
          error(
            "requirement_not_in_matrix",
            result.error || `${id} not found in traceability.md.`,
            {
              target: id,
              fix: `Add a row for ${id} — \`specgate req add\` writes one for you.`,
            }
          ),
        ]);
      }
    }

    const updated = result.updated;
    io.emit({ requirement: { id, status: opts.status, rowsUpdated: updated } }, () =>
      process.stdout.write(
        "\n" +
          ui.ok(
            `${c.bold}${id}${c.reset} ${ui.sym.arrow} ${c.ok}${c.bold}${opts.status}${c.reset} ` +
              ui.muted(`(${updated} row${updated > 1 ? "s" : ""} updated)`)
          ) +
          (plan.testsUnverified ? "" : nextAfter(queue().items, id, owner, view))
      )
    );

    // Said out loud, after the tick, because this is the command that writes
    // `Implemented` into the record other people read. A project nothing ran is
    // not a project that passed.
    if (plan.testsUnverified && !opts.json) {
      process.stderr.write("\n" + ui.warn(NO_TEST_COMMAND_WARNING.message));
      for (const line of NO_TEST_COMMAND_WARNING.fix) {
        process.stderr.write(`     ${ui.muted(line)}\n`);
      }
      process.stderr.write("\n");
    }

    process.exit(EXIT.OK);
  }

  /**
   * `done REQ-a REQ-b …`: each requirement is checked on its own, and the
   * project's tests run once. Closing eight requirements was eight runs of a
   * suite that starts Postgres every time (FinCore, #77). A requirement that
   * fails its own checks is reported and left as it was; the others close.
   */
  private executeMany(opts: DoneOptions, io: AgentIo): void {
    const NULL_SHAPE = { requirements: null };
    const bad = opts.reqIds.find((id) => !/^REQ-\d+$/.test(id));
    if (bad) {
      io.usage(NULL_SHAPE, [
        error("req_id_malformed", `Invalid REQ-id: ${bad} (expected REQ-NNN).`, {
          target: bad,
          fix: "Use the REQ-NNN form, e.g. REQ-007.",
        }),
      ]);
    }
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      // `resolveProjectDir` throws Errors.
      io.usage(NULL_SHAPE, [
        error("project_not_found", (err as Error).message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }
    refreshDerivedMatrix(projectDir);
    // Open changes' requirements are judged as they will be after archive (ADR-0035).
    const view = inFlightView(projectDir);
    const dir = view ? view.dir : projectDir;
    const ids = [...new Set(opts.reqIds)];
    const results = new Map<
      string,
      { ok: boolean; code?: string; message?: string; detail?: string }
    >();
    const harness: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    const testCmd = opts.testCmd || harness.testCmd;
    const gated = opts.check && DELIVERED_STATUSES.includes(opts.status);
    const tracePath = path.join(dir, TRACE);

    const owesTest = !opts.noCheck && OWES_TEST_STATUSES.includes(opts.status);

    for (const id of ids) {
      if (owesTest) {
        const missing = missingTest(dir, id);
        if (missing) {
          results.set(id, {
            ok: false,
            code: "apply_no_test",
            message: `no test names it yet (TDD-1): ${noTestFix(this.verb, id, opts.status, missing.scenario)}`,
          });
          continue;
        }
      }
      if (gated && fs.existsSync(tracePath)) {
        const blocker = deliveryBlocker(fs.readFileSync(tracePath, "utf8"), id);
        if (blocker) {
          results.set(id, { ok: false, code: blocker.code, message: blocker.message });
          continue;
        }
      }
      const plan = planDoneVerification(dir, {
        check: opts.check,
        strict: opts.strict,
        reqId: id,
        testCmd: undefined,
      });
      const validate = plan.steps.find((s) => s.stage === "validate");
      if (validate) {
        const run = spawnSync(
          process.execPath,
          [path.join(findCliRoot(__dirname), "bin", "specgate.js"), "validate", ...validate.argv],
          { encoding: "utf8" }
        );
        if (run.status !== 0) {
          results.set(id, {
            ok: false,
            code: "done_validate_failed",
            message: "validation failed",
            detail: (view ? view.toProject : (t: string) => t)(
              `${run.stdout || ""}${run.stderr || ""}`.trim()
            ),
          });
          continue;
        }
      }
      results.set(id, { ok: true });
    }

    const passing = ids.filter((id) => results.get(id)!.ok);
    let testsUnverified = false;
    const archCmd = (harness.archCmd || "").trim();
    if (passing.length > 0 && opts.check && archCmd) {
      const run = spawnSync(archCmd, { cwd: projectDir, encoding: "utf8", shell: true });
      if (run.status !== 0) {
        const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
        if (detail && !opts.json) process.stderr.write(indent(detail) + "\n\n");
        for (const id of passing) {
          results.set(id, {
            ok: false,
            code: "done_arch_failed",
            message: "the architecture check failed",
          });
        }
      }
    }
    if (passing.length > 0 && opts.check && passing.every((id) => results.get(id)!.ok)) {
      // One requirement fills `{req}`; several run the suite for the whole project (REQ-183).
      const cmd = gateTestCommand(
        (testCmd || "").trim(),
        passing.length === 1 ? passing[0] : undefined
      );
      if (cmd === "") {
        testsUnverified = true;
      } else {
        const run = spawnSync(cmd, { cwd: projectDir, encoding: "utf8", shell: true });
        if (run.status !== 0) {
          const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
          if (detail && !opts.json) process.stderr.write(indent(detail) + "\n\n");
          for (const id of passing) {
            results.set(id, {
              ok: false,
              code: "done_tests_failed",
              message: "the project's tests failed",
            });
          }
        }
      }
    }

    for (const id of ids.filter((x) => results.get(x)!.ok)) {
      const owner = view ? view.requirements.find((r) => r.id === id) : undefined;
      const result = writeStatus(projectDir, dir, owner, id, opts.status);
      if (result.ok) warnUntested(opts, dir, id);
      if (!result.ok) {
        results.set(id, {
          ok: false,
          code: "requirement_not_in_matrix",
          message: result.error || `${id} not found in traceability.md`,
        });
      }
    }

    const failed = ids.filter((id) => !results.get(id)!.ok);
    const doc = {
      requirements: ids.map((id) => {
        const r = results.get(id)!;
        return r.ok
          ? { id, status: opts.status, ok: true }
          : { id, ok: false, code: r.code, message: r.message };
      }),
    };
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
    } else {
      process.stdout.write(ui.header(`${this.verb} ${ids.join(" ")}`, opts.status));
      for (const id of ids) {
        const r = results.get(id)!;
        if (r.ok) {
          process.stdout.write(
            ui.ok(
              `${c.bold}${id}${c.reset} ${ui.sym.arrow} ${c.ok}${c.bold}${opts.status}${c.reset}`
            )
          );
        } else {
          if (r.detail) process.stderr.write(indent(r.detail) + "\n\n");
          process.stdout.write(
            ui.fail(
              `${c.bold}${id}${c.reset} not marked ${opts.status}: ${r.message}. ${ui.muted(`[${r.code}]`)}`
            )
          );
        }
      }
      if (ids.length > 1) {
        process.stdout.write(
          `\n  ${ui.progress(ids.length - failed.length, ids.length, "closed")}` +
            ui.muted(
              `   the project's tests ran ${passing.length > 0 && opts.check && !testsUnverified ? "once" : "no times"}`
            ) +
            "\n"
        );
      }
      if (testsUnverified) process.stderr.write("\n" + ui.warn(NO_TEST_COMMAND_WARNING.message));
      process.stdout.write(failed.length === 0 ? ui.next("specgate status") : "\n");
    }
    process.exit(failed.length > 0 ? EXIT.FAILURE : EXIT.OK);
  }
}

/** A command's own output, set in under ours so it reads as quoted evidence. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `     ${l}`)
    .join("\n");
}

const TRACE = path.join("docs", "specs", "traceability.md");

/**
 * The requirement's rows when none of them has a test, with the first scenario
 * id to name in the fix; null when a test names it or the matrix has no row
 * for it (writeStatus reports that). A generated matrix is derived from the
 * sources, so a test written since the last regeneration counts; a hand-kept
 * one is read as written.
 */
function missingTest(dir: string, id: string): { scenario?: string } | null {
  const rows: DerivedRow[] = isDerivedProject(dir)
    ? deriveRows(readDerivationSources(dir))
    : fs.existsSync(path.join(dir, TRACE))
      ? parseTraceability(readTrace(dir)).map((r) => ({
          requirement: r.requirement || undefined,
          scenarioId: r.scenarioId,
          testArtifact: r.testArtifact,
        }))
      : [];
  const own = rows.filter((r) => r.requirement === id);
  const tested = (r: DerivedRow) => {
    const t = String(r.testArtifact || "")
      .replace(/`/g, "")
      .trim();
    return t !== "" && t !== "-" && t.toUpperCase() !== "TBD";
  };
  if (own.length === 0 || own.some(tested)) return null;
  return { scenario: own.map((r) => r.scenarioId).find((x) => x && x !== "-") };
}

function noTestFix(verb: string, id: string, status: string, scenario?: string): string {
  const again =
    status === "Implemented"
      ? `specgate ${verb} ${id}`
      : `specgate ${verb} ${id} --status ${status}`;
  return `write a test that names ${id}${scenario ? ` (and its scenario ${scenario})` : ""}, then run ${again}`;
}

/** `--no-check` writes what it is told; it still says what the next gate will say. */
function warnUntested(opts: DoneOptions, dir: string, id: string): void {
  if (!opts.noCheck || opts.json || !OWES_TEST_STATUSES.includes(opts.status)) return;
  if (!missingTest(dir, id)) return;
  process.stderr.write(
    ui.warn(
      `${id} is ${opts.status} with no test that names it: \`validate --strict\` fails TDD-1 until one does.`
    )
  );
}

function readTrace(dir: string): string {
  return fs.readFileSync(path.join(dir, TRACE), "utf8");
}

/**
 * Write the status to the requirement's one owner: its open change's delta
 * when it is in flight (ADR-0035), spec.md or its capability spec otherwise,
 * or the hand-kept matrix of a project that is not derived.
 */
function writeStatus(
  projectDir: string,
  judgedDir: string,
  owner: InFlightRequirement | undefined,
  id: string,
  status: string
): { ok: boolean; updated: number; code?: string; error?: string } {
  if (owner) {
    const file = path.join(projectDir, owner.deltaFile);
    const next = setTraceFields(fs.readFileSync(file, "utf8"), id, { status });
    if (next === null) {
      return { ok: false, updated: 0, error: `${id} has no section in ${owner.deltaFile}.` };
    }
    fs.writeFileSync(file, next, "utf8");
    const rows = deriveRows(readDerivationSources(judgedDir)).filter(
      (r: DerivedRow) => r.requirement === id
    ).length;
    return { ok: true, updated: Math.max(rows, 1) };
  }
  // A generated matrix gets its status from spec.md: writing the row would
  // be undone by the next regeneration.
  const derivedRows = isDerivedProject(projectDir)
    ? writeRequirementFields(projectDir, id, { status })
    : undefined;
  if (derivedRows === undefined) {
    return new UpdateRequirementStatusUseCase(new DiskTraceabilityRepository()).execute(
      projectDir,
      id,
      status
    );
  }
  if (derivedRows === null) {
    return {
      ok: false,
      updated: 0,
      code: "requirement_not_in_matrix",
      error: `${id} has no section in spec.md or in a capability spec.`,
    };
  }
  return { ok: true, updated: derivedRows };
}

/**
 * What to run after a delivery: the next requirement, or — when that one was
 * its open change's last — archiving the change.
 */
function nextAfter(
  items: QueueItem[],
  id: string,
  owner: InFlightRequirement | undefined,
  view: InFlightView | null
): string {
  if (owner && view) {
    const rest = view.requirements.filter((r) => r.change === owner.change && r.id !== id);
    if (rest.every((r) => DELIVERED.includes(r.status))) {
      return ui.next(
        `specgate archive ${owner.change}`,
        `every requirement of ${owner.change} is delivered`
      );
    }
  }
  const following = nextRequirement(items, [id]);
  return following
    ? ui.next(`specgate apply ${following.requirement}`, "the next requirement")
    : ui.next("specgate status", "what is left, and the next requirement");
}
