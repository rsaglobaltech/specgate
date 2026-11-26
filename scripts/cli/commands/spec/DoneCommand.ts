import { readGatePolicy } from "../../../lib/gate-policy";
import { elsewhereFix, failingElsewhere } from "../../../lib/tests-elsewhere";
import {
  endStepRecord,
  keepStepsReview,
  stepsVerdict,
  STEPS_FINDING,
  STEPS_FIX,
} from "../../../lib/step-seal";
import { gitIdentity, missingApprovals } from "../../../lib/approvals";
import { scenariosOf } from "./ScenariosCommand";
import { keepEvidence, mustReproduce, readRed } from "../../../lib/evidence";
import type { ScenarioRun } from "../../../lib/evidence";
import { appendApplied } from "../../../lib/trust";
import { resolveProjectDir } from "../../../lib/project-root";
import { archRun } from "../../../lib/quality-run";
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
import { progress, runLogged } from "../../../lib/progress";
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
import { forShell } from "../../../lib/shell-command";
import { applyTestCommand, requirementTestFiles } from "../../../lib/test-selection";

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
  /** `--steps-reviewed`: a person read the steps changed after the code began (REQ-743). */
  stepsReviewed?: boolean;
}

/**
 * outside-judge REQ-745: why nobody's approval stops the delivery, or null. The
 * question the harness asks (REQ-315), asked of the open change that owns the
 * requirement; a requirement no change owns is not asked.
 */
export function approvalRefusal(
  projectDir: string,
  change: string | undefined
): { code: string; message: string; fix: string } | null {
  try {
    if (!change) return null;
    const missing = missingApprovals(projectDir, change);
    if (!missing) return null;
    return {
      code: "change_not_approved",
      message: `${missing.message} A requirement is delivered once a person approved its change.`,
      fix: missing.fix,
    };
  } catch {
    // Approval settings that cannot be read are validate's finding, not this one's.
    return null;
  }
}

/** REQ-743: why the requirement's steps stop its delivery, or null. */
function stepsRefusal(
  projectDir: string,
  id: string,
  opts: DoneOptions
): { code: string; message: string; fix: string } | null {
  const v = stepsVerdict(projectDir, id);
  if (!v.recorded || v.changed.length === 0) return null;
  if (!opts.stepsReviewed)
    return {
      code: "steps_changed_after_code",
      message: STEPS_FINDING(id, v.changed),
      fix: STEPS_FIX(id),
    };
  // A person's word is said at a terminal: a tool that runs its own commands has none.
  if (!process.stdin.isTTY && !process.env.SPECGATE_ASSUME_TTY)
    return {
      code: "steps_review_needs_person",
      message: `--steps-reviewed is a person's word, and this is not a terminal. ${STEPS_FINDING(id, v.changed)}`,
      fix: `A person runs it in a terminal: specgate apply ${id} --steps-reviewed`,
    };
  return null;
}

/** REQ-743: after the delivery — who reviewed the steps, or that nobody did; the record ends. */
function stepsDelivered(projectDir: string, id: string, opts: DoneOptions): string {
  const v = stepsVerdict(projectDir, id);
  let said = "";
  if (v.recorded && v.changed.length > 0 && opts.stepsReviewed) {
    keepStepsReview(projectDir, id, gitIdentity(projectDir), v.changed);
  } else if (!v.recorded && v.fresh.length > 0) {
    said = `${id}'s steps (${v.fresh.join(", ")}) were written in the same delivery as the code and were not reviewed: read them against its scenarios.`;
  }
  endStepRecord(projectDir, id);
  return said;
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
    else if (a === "--steps-reviewed") opts.stepsReviewed = true;
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
          '                       [--test-cmd "<command>"] [--steps-reviewed] [--project-dir <path>] [--json]\n\n' +
          "Without an id, takes the next requirement `specgate status` names. Refused\n" +
          "while no test names the requirement. Marks it delivered when the gate\n" +
          "`specgate check` runs passes for it; nothing is written when it fails. A\n" +
          "requirement of an open change is judged as it will be after archive, and\n" +
          "its status is written in the change's delta. Several ids are checked one by\n" +
          "one and the project's tests run once for all of them.\n\n" +
          "Refused for a change no person approved (`specgate change approve <id>`,\n" +
          "at a terminal), and while a sealed acceptance test is not as approved.\n\n" +
          "Options:\n" +
          `  --status <Status>   Target status (default: Implemented).\n` +
          `                      One of: ${ALLOWED_STATUSES.join(", ")}\n` +
          "  --no-check          Write the status without running the gate (Implemented,\n" +
          "                      Verified and Released run it by default).\n" +
          "  --check, --strict   Run the gate for any status, Approved included.\n" +
          "  --steps-reviewed    A person read the step definitions changed after the code\n" +
          "                      began (steps_changed_after_code). Only at a terminal.\n" +
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
    // REQ-515: the requirement's own tests, through `{files}` or `{req}`.
    const testCmd = applyTestCommand(opts.testCmd, harness);
    const plan = planDoneVerification(dir, {
      check: opts.check,
      strict: opts.strict,
      reqId: id,
      testCmd,
      archCmd: harness.archCmd,
      files: (testCmd || "").includes("{files}") ? requirementTestFiles(projectDir, [id]) : "",
    });

    for (const step of plan.steps) {
      // REQ-654: each stage tells when it starts and how it ends.
      const stageName =
        step.stage === "validate" ? "validate" : step.stage === "arch" ? "architecture" : "tests";
      const exec = () =>
        step.stage === "validate"
          ? (progress({ stage: "validate", state: "running" }),
            spawnSync(
              process.execPath,
              [
                path.join(findCliRoot(__dirname), "bin", "specgate.js"),
                "validate",
                ...step.argv,
                ...(opts.json ? ["--json"] : []),
              ],
              { encoding: "utf8" }
            ))
          : runLogged(stageName, forShell(step.argv[0]), projectDir);
      const label =
        step.stage === "validate"
          ? `Specification   ${ui.muted(`the gate, for ${id}`)}`
          : step.stage === "arch"
            ? `Architecture    ${ui.muted(step.argv[0])}`
            : `Tests           ${ui.muted(step.argv[0])}`;
      const run = opts.json ? exec() : ui.task(label, exec, (r) => ({ ok: r.status === 0 }));
      progress({ stage: stageName, state: run.status === 0 ? "passed" : "failed" });

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
      // recover-guidance REQ-787: only another requirement's test is red — say so, and that repairing it is in scope.
      const others =
        step.stage === "tests"
          ? failingElsewhere(`${run.stdout || ""}${run.stderr || ""}`, [id])
          : [];
      if (others.length) {
        const e = elsewhereFix(others, [id], again);
        io.fail(NULL_SHAPE, [
          ...findings,
          error("done_tests_failed", `not marked ${opts.status}: ${e.message}.`, {
            target: id,
            fix: e.fix,
          }),
        ]);
      }
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

    // REQ-745: nobody approved its change. After the gate — what it finds is
    // what keeps a change from being approved — and whatever `--no-check`
    // says: an approval is not one of the gate's checks.
    const unapproved = DELIVERED_STATUSES.includes(opts.status)
      ? approvalRefusal(projectDir, owner?.change)
      : null;
    if (unapproved)
      io.fail(NULL_SHAPE, [
        error(unapproved.code, `${id} not marked ${opts.status}: ${unapproved.message}`, {
          target: owner!.change,
          fix: unapproved.fix,
        }),
      ]);

    // REQ-662: with executable scenarios required, the requirement's own must pass.
    const bdd = gated ? bddRefusal(projectDir, id, !!opts.json) : null;
    if (bdd)
      io.fail(NULL_SHAPE, [
        error(bdd.code, `${id} not marked ${opts.status}: ${bdd.message}`, {
          target: id,
          fix: bdd.fix,
        }),
      ]);

    // REQ-743: steps changed after the code began wait for a person.
    const steps = gated ? stepsRefusal(projectDir, id, opts) : null;
    if (steps)
      io.fail(NULL_SHAPE, [
        error(steps.code, `${id} not marked ${opts.status}: ${steps.message}`, {
          target: id,
          fix: steps.fix,
        }),
      ]);

    const result = writeStatus(projectDir, dir, owner, id, opts.status);
    if (result.ok) applied(opts, projectDir, dir, id);
    const stepsSaid = result.ok && gated ? stepsDelivered(projectDir, id, opts) : "";
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
    io.emit(
      {
        requirement: {
          id,
          status: opts.status,
          rowsUpdated: updated,
          ...(stepsSaid ? { steps: stepsSaid } : {}),
        },
      },
      () =>
        process.stdout.write(
          "\n" +
            ui.ok(
              `${c.bold}${id}${c.reset} ${ui.sym.arrow} ${c.ok}${c.bold}${opts.status}${c.reset} ` +
                ui.muted(`(${updated} row${updated > 1 ? "s" : ""} updated)`)
            ) +
            // gate-runs-scenarios REQ-735: said plainly, at each delivery, what the gate did not check.
            (gated &&
            readGatePolicy(projectDir).bdd !== "required" &&
            scenariosOf(projectDir, id).length > 0
              ? `  ${ui.muted(`·  ${id} is delivered on a test that names it: its scenarios were not run. specgate migrate bdd makes the gate run them.`)}\n`
              : "") +
            (stepsSaid ? `  ${ui.muted(`·  ${stepsSaid}`)}\n` : "") +
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
    const testCmd = applyTestCommand(opts.testCmd, harness);
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
      const run = harness.archSarif
        ? archRun(projectDir, archCmd, harness.archSarif)
        : spawnSync(forShell(archCmd), { cwd: projectDir, encoding: "utf8", shell: true });
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
      // REQ-515: `{files}` holds the tests of every requirement given.
      const cmd = gateTestCommand(
        (testCmd || "").trim(),
        passing.length === 1 ? passing[0] : undefined,
        (testCmd || "").includes("{files}") ? requirementTestFiles(projectDir, passing) : ""
      );
      if (cmd === "") {
        testsUnverified = true;
      } else {
        const run = spawnSync(forShell(cmd), { cwd: projectDir, encoding: "utf8", shell: true });
        if (run.status !== 0) {
          const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
          if (detail && !opts.json) process.stderr.write(indent(detail) + "\n\n");
          // recover-guidance REQ-787: only another requirement's test is red.
          const others = failingElsewhere(detail, passing);
          for (const id of passing) {
            results.set(id, {
              ok: false,
              code: "done_tests_failed",
              message: others.length
                ? elsewhereFix(others, passing, `specgate ${this.verb} ${passing.join(" ")}`)
                    .message
                : "the project's tests failed",
            });
          }
          if (others.length && !opts.json)
            process.stderr.write(
              indent(
                elsewhereFix(others, passing, `specgate ${this.verb} ${passing.join(" ")}`).fix
              ) + "\n\n"
            );
        }
      }
    }

    // REQ-745: a requirement of a change nobody approved is not delivered.
    if (DELIVERED_STATUSES.includes(opts.status))
      for (const id of ids.filter((x) => results.get(x)!.ok)) {
        const change = view ? view.requirements.find((r) => r.id === id)?.change : undefined;
        const unapproved = approvalRefusal(projectDir, change);
        if (unapproved)
          results.set(id, { ok: false, code: unapproved.code, message: unapproved.message });
      }

    // REQ-662: with executable scenarios required, each requirement's own must pass.
    if (opts.check)
      for (const id of ids.filter((x) => results.get(x)!.ok)) {
        const bdd = bddRefusal(projectDir, id, !!opts.json);
        if (bdd) results.set(id, { ok: false, code: bdd.code, message: bdd.message });
        const steps = bdd ? null : stepsRefusal(projectDir, id, opts);
        if (steps) results.set(id, { ok: false, code: steps.code, message: steps.message });
      }

    for (const id of ids.filter((x) => results.get(x)!.ok)) {
      const owner = view ? view.requirements.find((r) => r.id === id) : undefined;
      const result = writeStatus(projectDir, dir, owner, id, opts.status);
      if (result.ok) applied(opts, projectDir, dir, id);
      if (result.ok && opts.check) stepsDelivered(projectDir, id, opts);
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
 * REQ-353: tick the tasks of the requirement's open change that name it. The
 * harness delivered every requirement and archive still counted 11, 21 and 13
 * unchecked tasks (truck-flote, MS-13): the Tasks layer said nothing true.
 * `deltaFile` is `docs/specs/changes/<id>/specs/<capability>/spec.md`.
 */
function tickTasksOf(deltaFile: string, id: string): void {
  const parts = deltaFile.split(/[\\/]/);
  const at = parts.lastIndexOf("specs", parts.length - 3);
  if (at < 1) return;
  const tasks = path.join(parts.slice(0, at).join(path.sep), "tasks.md");
  if (!fs.existsSync(tasks)) return;
  // The id came from the command line: escaped, so it is matched as text.
  const names = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const text = fs.readFileSync(tasks, "utf8");
  const next = text.replace(/^(\s*[-*]\s*)\[ \](.*)$/gm, (line, lead, rest) =>
    names.test(rest) ? `${lead}[x]${rest}` : line
  );
  if (next !== text) fs.writeFileSync(tasks, next, "utf8");
}

/**
 * Write the status to the requirement's one owner: its open change's delta
 * when it is in flight (ADR-0035), spec.md or its capability spec otherwise,
 * or the hand-kept matrix of a project that is not derived.
 */
/** Delivered: say so when no test names it, and keep it as trust evidence when the gate passed (REQ-674). */
function applied(opts: DoneOptions, projectDir: string, dir: string, id: string): void {
  warnUntested(opts, dir, id);
  if (opts.check && opts.status === "Implemented") appendApplied(projectDir, id);
  // REQ-680: the scenarios that proved it, and what the browser left.
  const run = scenarioRuns.get(id);
  if (run && run.exitCode === 0) keepEvidence(projectDir, id, run);
}

/** Each requirement's scenario run in this apply, for its evidence (REQ-680). */
const scenarioRuns = new Map<string, ScenarioRun>();

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
    if (DELIVERED_STATUSES.includes(status)) tickTasksOf(file, id);
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
 * What to run after a delivery: the next requirement — of the same open change
 * when it has one to take — or, when that one was its open change's last,
 * archiving the change.
 */
export function nextAfter(
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
  // The change being built first, then the project's queue (REQ-465).
  const following =
    (owner &&
      nextRequirement(
        items.filter((it) => it.change === owner.change),
        [id]
      )) ||
    nextRequirement(items, [id]);
  return following
    ? ui.next(`specgate apply ${following.requirement}`, "the next requirement")
    : ui.next("specgate status", "what is left, and the next requirement");
}

/**
 * Why a requirement's scenarios refuse it (bdd-gate REQ-662): in a project with
 * `bdd: required`, its `bdd_cmd` run with `{tags}` as `@<REQ>`; null when they pass
 * or the project does not require them.
 */
function bddRefusal(
  projectDir: string,
  id: string,
  json: boolean
): { code: string; message: string; fix: string } | null {
  // REQ-683: a bug is delivered only after it was seen red.
  if (mustReproduce(projectDir, id) && !readRed(projectDir, id))
    return {
      code: "apply_not_reproduced",
      message: "it is a bug to reproduce first, and its scenarios were never seen failing",
      fix: `specgate reproduce run ${id}`,
    };
  if (readGatePolicy(projectDir).bdd !== "required") return null;
  const bddCmd = (readHarnessConfig(projectDir)?.bddCmd || "").trim();
  if (!bddCmd)
    return {
      code: "apply_bdd_missing",
      message: "the gate requires executable scenarios and no bdd_cmd runs them",
      fix: 'specgate config set bdd_cmd "<runs the feature files, with {tags}>"',
    };
  const cmd = bddCmd.includes("{tags}")
    ? bddCmd.split("{tags}").join(`@${id}`)
    : `${bddCmd} @${id}`;
  const startedAt = Date.now();
  const run = spawnSync(forShell(cmd), { cwd: projectDir, encoding: "utf8", shell: true });
  // REQ-680: what ran, kept for the evidence once the requirement is delivered.
  scenarioRuns.set(id, {
    command: cmd,
    exitCode: run.status ?? 1,
    ms: Date.now() - startedAt,
    output: `${run.stdout || ""}${run.stderr || ""}`,
    startedAt,
  });
  if (run.status === 0) return null;
  const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
  if (detail && !json)
    process.stderr.write(indent(detail.split("\n").slice(-30).join("\n")) + "\n\n");
  return {
    code: "apply_bdd_failed",
    message: `its scenarios failed: ${cmd}`,
    fix: `make its scenarios pass — the steps and the code — then run specgate apply ${id}`,
  };
}
