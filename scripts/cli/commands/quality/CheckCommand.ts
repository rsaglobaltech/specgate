import { detectTestCommand } from "../../../harness/init";
import { failingElsewhere } from "../../../lib/tests-elsewhere";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveProjectDir, findCliRoot } from "../../../lib/project-root";
import { error, info, warning } from "../../../lib/diagnostics";
import { agentIo, wantsJson, AgentIo } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import {
  planGateCheck,
  NO_TEST_COMMAND_WARNING,
} from "../../../../packages/core/src/domain/DoneVerification";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import {
  runRequirementScenarios,
  scenarioCommand,
  scenariosRequired,
} from "../../../lib/scenario-runs";
import { deliveredWithFeature } from "../spec/StatusCommand";
import type { HarnessSettings } from "../../../../packages/core/src/domain/HarnessConfig";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
import { inFlightView, unwrittenNotes } from "../../../lib/in-flight";
import { listChangeIds } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { scopeDiagnostics, sealDiagnostics } from "../../../lib/approvals";
import {
  acceptanceRun,
  acceptanceSealDiagnostics,
  sealedAcceptance,
} from "../../../lib/acceptance";
import { checkIdsAgainstBase } from "../../../lib/base-ids";
import { branchControls } from "../../../lib/controls";
import type { BaseIdCheck } from "../../../lib/base-ids";
import { prBase, ticketKeyFindings } from "../../../lib/ticket-keys";
import { changeOverlaps } from "../../../lib/change-overlap";
import { changeBaseFindings, recordBases } from "../../../lib/change-base";

import { c } from "../../../lib/ui";
import * as ui from "../../../lib/ui";
import { recordCheck } from "../../../pet/pet";
import { runLockHolder } from "../../../lib/harness-guard";
import {
  archRun,
  gateContext,
  runStages,
  stagesPassed,
  type CheckOutcome,
} from "../../../lib/quality-run";
import type { Stage } from "../../../../packages/core/src/domain/QualityChecks";
import { forShell } from "../../../lib/shell-command";
import { steering } from "../../../lib/steering";
import { driftFindings, driftSince } from "../../../lib/drift";
import { GateStages, validateFindings } from "../../../lib/gate-stages";
import { lastCheckAnswer, recordLastCheck } from "../../../lib/last-check";
import { BASELINE_FILE, parseBaseline } from "../../../../packages/core/src/domain/GateBaseline";
import { checksFor } from "../../../../packages/core/src/domain/QualityChecks";
import { gateTestCommand } from "../../../../packages/core/src/domain/DoneVerification";
import { planTests } from "../../../lib/test-selection";
import { actorsNotDrawn, glossaryMissing, refreshDomainDiagrams } from "../../../lib/domain-docs";
import { stackFileCommand } from "../../../lib/stack-detect";
import { startShell, type StageRun } from "../../../lib/stage-run";
import { progress, runLogged } from "../../../lib/progress";
import type { Diagnostic } from "../../../lib/diagnostics";
import {
  GATE_POLICY_FILE,
  describePolicy,
  levelOf,
  readGatePolicy,
  RULES,
} from "../../../lib/gate-policy";

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--base <branch>] [--ci] [--json]
  ✅ ${c.bold}specgate check --affected${c.reset} [dir] [--base <ref>] [--no-cache]   only what the change touches
  ✅ ${c.bold}specgate check --last${c.reset} [dir] [--json]   the last gate result, without running it
  ✅ ${c.bold}specgate check --baseline${c.reset} [dir] [--json]   record today's findings; only new ones fail

  The gate — what to run before a pull request:
    1. validate --strict   specs, scenarios, traceability, links and coverage
    2. your architecture   arch_cmd: in harness.config.yaml (ArchUnit, …), if set
    3. your tests          from --test-cmd, or test_cmd: in harness.config.yaml
                           (2 and 3 run side by side; gate_parallel: false runs
                           them one after the other)
    4. your scenarios      with bdd: required in .specgate/gate.yaml, each delivered
                           requirement's, through bdd_cmd (--no-scenarios skips)
    5. sealed acceptance   the tests a person sealed, through acceptance_cmd
    6. your quality checks checks: in harness.config.yaml — attempt and end;
                           --ci adds the ci ones, and a check that cannot run fails

  Before them, open changes are judged as approved: a sealed requirement or
  acceptance test that changed fails. With --base, what the branch changes in
  the controls (guard, gate policy, approvals, evidence) is named.

  --affected runs the tests of what changed since the base: the matrix's
  tests of each requirement whose spec, feature, code or test changed, the
  changed tests, and the tests whose imports reach a changed file. Its test
  command takes them as {files} (test_cmd_affected:, or test_cmd); {req} is
  the one requirement touched. A change to package.json, a lockfile,
  harness.config.yaml, a build configuration or a full_on: glob — or a file
  nothing links to — runs the whole suite, and says why. A test that passed
  on the same code is not run again (--no-cache runs it). --ci always runs
  the whole suite.

  Without a test command it still passes, and says it checked the
  specification, not the code.

  Requirement ids are compared with the base branch (--base, SPECGATE_BASE,
  pr.base in alm.config.yaml, or origin's default): the same id with another title there fails the gate
  before the merge. Skipped, and said, without git or a base to read.

  With --json, every answer lists the gate's stages — ids, changes, validate,
  architecture, tests, scenarios, acceptance, each quality check — with its command, its result
  (passed, failed, skipped, not run), its ms and its findings, and the
  selection of tests it ran: mode (affected or full), reason, base, changed,
  requirements, tests, cached and command. Each check keeps its result in the
  repository's git folder; --last reads it back.

  --baseline writes the matrix findings validate --strict has today to
  docs/specs/gate-baseline.json. After it, check and validate fail only on a
  finding absent from that file, report the others as baselined, and name
  each baselined finding that no longer occurs (baseline_fixed).

  Exit 0 green · 1 the gate failed · 2 usage error.

`
  );
}

/** How a quality check's stage ended, and what it found (REQ-503). */
function qualityStage(o: CheckOutcome): ["passed" | "failed" | "skipped", Diagnostic[]] {
  if (o.skipped) {
    return [
      "skipped",
      [info("check_not_run", `${o.name} did not run: ${o.skipped}.`, { target: o.name })],
    ];
  }
  if (o.ok) return ["passed", []];
  const fresh = (o.findings?.fresh || []).map((f) =>
    (o.gate ? error : warning)("quality_finding", f, { target: o.name })
  );
  return [
    "failed",
    [
      ...fresh,
      (o.gate ? error : warning)(
        "quality_check_failed",
        o.couldNotRun ? `${o.name} could not run: ${o.couldNotRun}` : `${o.name} failed.`,
        {
          target: o.name,
          fix: o.couldNotRun
            ? `Fix how ${o.name} runs, then run \`specgate check\` again.`
            : "Fix what the check reports, then run `specgate check` again.",
        }
      ),
    ],
  ];
}

/**
 * `specgate check` — one name for the gate.
 *
 * The team feedback was that the tool is hard to absorb, and the gate was a
 * good example: `validate` plus a choice of five `--strict-*` flags, and the
 * suite run by a different command. This is that whole decision, made once.
 */
export class CheckCommand extends BaseCommand {
  /** `check --last`: the result the last check kept, without running the gate (REQ-504). */
  private last(io: AgentIo, projectDir: string): void {
    const answer = lastCheckAnswer(projectDir);
    io.emit(answer, () => {
      process.stdout.write(ui.header("check --last", path.basename(projectDir)));
      const l = answer.lastCheck;
      if (!l) {
        process.stdout.write(
          ui.info("No check has run here yet.") + ui.next("specgate check", "runs the gate")
        );
        return;
      }
      process.stdout.write(
        (l.passed ? ui.ok("The last gate passed.") : ui.warn("The last gate failed.")) +
          `     ${ui.muted(`${l.ranAt}${l.commit ? ` · ${l.commit.slice(0, 12)}` : ""}${l.branch ? ` on ${l.branch}` : ""}${l.dirty ? " with uncommitted changes" : ""}`)}\n\n`
      );
      for (const st of l.stages) {
        const what = st.name ? `${st.stage} ${st.name}` : st.stage;
        process.stdout.write(`  ${what.padEnd(26)}${st.result}\n`);
      }
      process.stdout.write("\n");
    });
  }

  /**
   * `check --baseline` (REQ-531): `validate --strict` writes the findings it
   * has today to the baseline, and passes on them. What it cannot baseline —
   * anything outside the matrix — still fails, and is said.
   */
  private writeBaseline(io: AgentIo, projectDir: string): void {
    const run = spawnSync(
      process.execPath,
      [
        path.join(findCliRoot(__dirname), "bin", "specgate.js"),
        "validate",
        projectDir,
        "--strict",
        "--write-baseline",
        "--json",
      ],
      { encoding: "utf8" }
    );
    const file = path.join(projectDir, BASELINE_FILE);
    let recorded = 0;
    try {
      recorded = parseBaseline(fs.readFileSync(file, "utf8")).findings.length;
    } catch {
      recorded = 0;
    }
    if (run.status !== 0) {
      io.fail({ baseline: { file: BASELINE_FILE, findings: recorded } }, [
        ...validateFindings(run.stdout),
        error(
          "baseline_incomplete",
          `${BASELINE_FILE} records ${recorded} finding(s), and validate --strict still fails on what a baseline cannot hold.`,
          { fix: "Fix what validate reports, then run `specgate check --baseline` again." }
        ),
      ]);
    }
    io.emit({ baseline: { file: BASELINE_FILE, findings: recorded } }, () => {
      process.stdout.write(ui.header("check --baseline", path.basename(projectDir)));
      process.stdout.write(
        ui.ok(`${recorded} finding(s) recorded in ${BASELINE_FILE}.`) +
          `     ${ui.muted("From now on the gate fails only on a finding that is not in it. Commit the file.")}\n\n`
      );
    });
  }

  public async execute(): Promise<void> {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const json = wantsJson(argv);
    const io: AgentIo = agentIo(json);

    let testCmdFlag: string | undefined;
    let baseFlag: string | undefined;
    let ci = false;
    let last = false;
    let affected = false;
    let noCache = false;
    let noScenarios = false;
    let baseline = false;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--ci") {
        ci = true;
      } else if (a === "--last") {
        last = true;
      } else if (a === "--affected") {
        affected = true;
      } else if (a === "--baseline") {
        baseline = true;
      } else if (a === "--no-cache") {
        noCache = true;
      } else if (a === "--no-scenarios") {
        noScenarios = true;
      } else if (a === "--test-cmd") {
        testCmdFlag = argv[++i];
        if (testCmdFlag === undefined) {
          io.usage(NULL_SHAPE, [
            error("missing_value", "--test-cmd needs a command.", {
              fix: 'specgate check --test-cmd "npm test"',
            }),
          ]);
        }
      } else if (a === "--base") {
        baseFlag = argv[++i];
        if (baseFlag === undefined) {
          io.usage(NULL_SHAPE, [
            error("missing_value", "--base needs a branch.", {
              fix: "specgate check --base develop",
            }),
          ]);
        }
      } else if (a === "--json") {
        continue;
      } else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for check: ${a}`, {
            fix: "specgate check --help",
          }),
        ]);
      } else {
        positional.push(a);
      }
    }
    if (positional.length > 1) {
      io.usage(NULL_SHAPE, [
        error("unexpected_argument", `check takes one directory, got ${positional.length}.`, {
          fix: "specgate check [dir]",
        }),
      ]);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(positional[0] || ".");
    } catch {
      projectDir = path.resolve(positional[0] || ".");
    }
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      io.usage(NULL_SHAPE, [
        error("project_dir_not_found", `Directory not found: ${projectDir}`, {
          fix: "specgate check [dir]",
        }),
      ]);
    }

    // REQ-504: the last result, read back without running the gate.
    if (last) return this.last(io, projectDir);
    // REQ-531: today's findings, written down so only new ones fail.
    if (baseline) return this.writeBaseline(io, projectDir);

    // REQ-503: every stage, planned up front and set as the gate reaches it,
    // so a failed gate still says what passed before it and what never ran.
    const harness: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    // REQ-548: the stack file's test command when the configuration sets none.
    const testCmd =
      testCmdFlag !== undefined
        ? testCmdFlag
        : harness.testCmd || stackFileCommand(projectDir, "test") || undefined;
    const archCmd = (harness.archCmd || "").trim();
    const qualityStages: Stage[] = ci ? ["attempt", "end", "ci"] : ["attempt", "end"];
    // REQ-510 … REQ-516: which tests run — the whole suite, or what the change
    // touches — and the command that runs them; said in every answer.
    const tests = planTests(projectDir, {
      affected,
      ci,
      noCache,
      base: baseFlag || prBase(projectDir) || undefined,
      testCmd: testCmdFlag !== undefined ? testCmdFlag : harness.testCmd ? undefined : testCmd,
      harness,
    });
    const selection = tests.selection;
    const plannedTests = tests.command ?? gateTestCommand((testCmd || "").trim());
    const gate = new GateStages({
      archCmd: archCmd || null,
      testCmd: plannedTests || null,
      checks: harness.quality ? checksFor(harness.quality, qualityStages) : [],
      scenariosCmd: scenariosRequired(projectDir) ? scenarioCommand(projectDir) || null : null,
      acceptance: sealedAcceptance(projectDir).length > 0,
    });
    /** Fail the gate: keep the result, then answer with every stage. */
    const fail = (payload: { check: unknown }, diags: Diagnostic[]): never => {
      recordCheck(projectDir, false);
      recordLastCheck(projectDir, {
        passed: false,
        ci,
        stages: gate.list(),
        status: diags,
        selection,
      });
      return io.fail({ ...payload, stages: gate.list(), selection }, diags);
    };
    /** How long a stage took, from when it started. */
    const since = (started: number) => Date.now() - started;

    // A generated matrix is a cache of spec.md, the tags and the tests: bring
    // it up to date before the gate reads it, so nobody runs `matrix` by hand.
    // `validate` on its own — what CI runs — still fails when it is stale.
    if (!json) process.stdout.write(ui.header("check", path.basename(projectDir)));
    const refreshed = refreshDerivedMatrix(projectDir);
    if (refreshed && !json) {
      process.stdout.write(
        `  ${ui.muted("↻  docs/specs/traceability.md regenerated from its sources")}\n`
      );
    }
    // What the gate requires here (issue #494): said once, so a pass under a
    // relaxed policy is never read as a pass under the strict one.
    const policy = readGatePolicy(projectDir);
    const relaxed = RULES.some((r) => levelOf(policy, r) !== "error");
    /** Findings the policy reports instead of failing: they travel with the pass. */
    const policyReported: Diagnostic[] = [];
    if (!json && policy.source === "file") {
      process.stdout.write(`  ${ui.muted(`·  Policy         ${describePolicy(policy)}`)}\n`);
    }
    // REQ-540, REQ-541: the entity model and the actors diagram, the same way.
    for (const file of refreshDomainDiagrams(projectDir)) {
      if (!json) process.stdout.write(`  ${ui.muted(`↻  ${file} regenerated from its sources`)}\n`);
    }
    // REQ-594: an actors diagram that cannot be drawn says why.
    const undrawn = actorsNotDrawn(projectDir);
    if (undrawn && !json) process.stdout.write(`  ${ui.muted(`·  ${undrawn}`)}\n`);
    // REQ-595: names the project uses that its glossary does not define yet.
    const undefinedTerms = glossaryMissing(projectDir);
    if (undefinedTerms.length > 0 && !json) {
      process.stdout.write(
        `  ${ui.muted(`·  docs/specs/glossary.md does not define ${undefinedTerms.join(", ")} — archive adds them as rows to fill`)}\n`
      );
    }

    // On a ticket's branch, commits that do not name the ticket (ADR-0039);
    // and requirements another open change rewrites too (REQ-160).
    // Said whatever the gate decides: a failed gate is fixed on the same branch.
    // REQ-330..334: the organization's principles this repository follows, and
    // behaviour changed without a specification. A failed principle and drift
    // in a project that gates on it fail below, with the other findings.
    const harnessEarly: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    const steer = steering(projectDir);
    const driftMode = harnessEarly.drift || "report";
    const drift =
      driftMode === "off" ? { base: "", commits: [] } : driftSince(projectDir, baseFlag || "");
    const ticketKeys = [
      ...ticketKeyFindings(projectDir, baseFlag),
      ...changeOverlaps(projectDir),
      ...changeBaseFindings(projectDir, baseFlag),
      ...steer.findings,
      ...driftFindings(drift, driftMode === "gate"),
    ];
    // After the comparison, so the first sight of a change records, not warns (REQ-168).
    recordBases(projectDir);
    if (!json) {
      for (const d of ticketKeys) process.stdout.write(ui.warn(d.message) + ui.fix(d.fix ?? ""));
      if (steer.principles) {
        process.stdout.write(
          `  ${ui.muted(`·  Principles     ${steer.principles.version || "no version"}${steer.principles.source ? ` from ${steer.principles.source}` : ""}`)}
`
        );
      }
    }
    const blocking = ticketKeys.filter((d) => d.severity === "error");
    if (blocking.length > 0) {
      recordCheck(projectDir, false);
      io.fail(NULL_SHAPE, [
        ...ticketKeys,
        error(
          "check_steering_failed",
          `The gate failed: ${[...new Set(blocking.map((d) => d.code))].join(", ")}.`,
          { fix: "Fix what is reported above, then run `specgate check` again." }
        ),
      ]);
    }

    // Two branches allocate ids as max+1 over their own checkout; the
    // collision is caught here, before the merge (ADR-0036). Against the same
    // base as ticket keys: a gitflow project's `pr: base:` (REQ-120).
    const idsStarted = Date.now();
    const idsLevel = levelOf(policy, "ids");
    const ids: BaseIdCheck =
      idsLevel === "off"
        ? { state: "skipped", reason: `ids is off in ${GATE_POLICY_FILE}` }
        : checkIdsAgainstBase(
            projectDir,
            baseFlag || process.env.SPECGATE_BASE || prBase(projectDir) || undefined
          );
    const idWarnings: Diagnostic[] = [];
    if (ids.state === "checked" && ids.collisions.length > 0 && idsLevel === "warning") {
      // Reported, not failed: the policy sets ids to warning.
      for (const x of ids.collisions) {
        idWarnings.push(
          warning(
            "id_taken_on_base",
            `${x.id} is "${x.here}" here and "${x.base}" on ${ids.base}.`,
            {
              target: x.id,
              fix: `renumber ${x.id} on this branch to ${ids.nextFree}, the next id free on both sides`,
            }
          )
        );
      }
      if (!json) {
        for (const d of idWarnings) process.stdout.write(ui.warn(`${d.message}  [${d.code}]`));
      }
    } else if (ids.state === "checked" && ids.collisions.length > 0) {
      const first = ids.collisions[0];
      const collisions = [
        ...ids.collisions.slice(1).map((x) =>
          error("id_taken_on_base", `${x.id} is "${x.here}" here and "${x.base}" on ${ids.base}.`, {
            target: x.id,
          })
        ),
        error(
          "id_taken_on_base",
          `${first.id} is "${first.here}" here and "${first.base}" on ${ids.base}.`,
          {
            target: first.id,
            fix: `renumber ${first.id} on this branch to ${ids.nextFree}, the next id free on both sides`,
          }
        ),
      ];
      gate.set("ids", "failed", collisions, { ms: since(idsStarted) });
      fail(NULL_SHAPE, [...ticketKeys, ...collisions]);
    }
    // branch-controls REQ-754: what the branch changes in the controls, named for the person who reviews it.
    const controlsLevel = levelOf(policy, "controls");
    if (ids.state === "checked" && controlsLevel !== "off") {
      const ctl = branchControls(projectDir, ids.base);
      if (ctl.state === "checked" && ctl.changed.length) {
        const say = (d: string) =>
          `${d} on this branch, against ${ids.base}: a person who reviews the branch reads it before it merges.`;
        const fix =
          "Review it as part of the pull request; make .specgate/ and docs/specs/changes/*/approvals.json code-owned so that review is required.";
        if (controlsLevel === "error") {
          const errors = ctl.changed.map((d) =>
            error("controls_changed_on_branch", say(d), { fix })
          );
          gate.set("ids", "failed", errors, { ms: since(idsStarted) });
          fail(NULL_SHAPE, [...ticketKeys, ...errors]);
        }
        for (const d of ctl.changed) {
          const w = warning("controls_changed_on_branch", say(d), { fix });
          idWarnings.push(w);
          if (!json) process.stdout.write(ui.warn(`${w.message}  [${w.code}]`));
        }
      }
    }
    gate.set(
      "ids",
      ids.state === "checked" ? "passed" : "skipped",
      ids.state === "checked"
        ? idWarnings
        : [
            info(
              "ids_not_compared",
              `Requirement ids were not compared with a base: ${ids.reason}.`,
              {
                fix: "specgate check --base <branch>",
              }
            ),
          ],
      { ms: since(idsStarted) }
    );
    if (!json) {
      process.stdout.write(
        `  ${ui.muted(
          ids.state === "checked"
            ? `·  Ids            compared with ${ids.base}`
            : `·  Ids            not compared with a base — ${ids.reason}`
        )}\n`
      );
    }

    // Open changes are judged as they will be after archive (ADR-0035): what
    // passes here is what passes once they are archived.
    const changesStarted = Date.now();
    // REQ-741: with them, the changes whose approval sealed no requirement.
    const unwritten = [
      ...unwrittenNotes(projectDir),
      ...listChangeIds(projectDir).flatMap((id) => sealDiagnostics(projectDir, id).warnings),
      ...scopeDiagnostics(projectDir, listChangeIds(projectDir)).warnings,
      // sealed-acceptance REQ-758: where the rule `acceptance` is a warning.
      ...listChangeIds(projectDir).flatMap(
        (id) => acceptanceSealDiagnostics(projectDir, id).warnings
      ),
    ];
    if (!json) {
      for (const n of unwritten) {
        process.stdout.write(
          `  ${ui.muted(
            n.code === "approval_not_sealed" ||
              n.code === "file_outside_design" ||
              n.code === "acceptance_not_sealed"
              ? `·  Change          ${n.message}`
              : `·  Change          ${n.target} — delta not written yet, not judged until it is`
          )}\n`
        );
      }
    }
    const view = inFlightView(projectDir);
    const toProject = (t: string) => (view ? view.toProject(t) : t);
    if (view && view.problems.length > 0) {
      const first = view.problems[0].change;
      // One fix line per refusal: the findings say what, the last says how.
      const problems = view.problems.map(({ fix: _fix, change: _change, ...d }) => d);
      gate.set("changes", "failed", problems, { ms: since(changesStarted) });
      // What a person approved changed: the fix is to restore it or approve again, not to fix the delta.
      const APPROVED = new Set([
        "acceptance_not_sealed",
        "approved_requirement_changed",
        "file_outside_design",
      ]);
      const approvedOnly = problems.every((d) => APPROVED.has(d.code));
      fail(NULL_SHAPE, [
        ...ticketKeys,
        ...problems,
        approvedOnly
          ? error(
              "check_approved_changed",
              `The gate failed: what a person approved in open change '${first}' is not what is there now.`,
              {
                target: first,
                fix: view.problems.find((d) => d.fix)?.fix || `specgate change approve ${first}`,
              }
            )
          : error(
              "check_change_invalid",
              `The gate failed: open change '${first}' does not validate.`,
              {
                target: first,
                fix: `Fix its delta, then run \`specgate check\` again (\`specgate change validate ${first}\` lists every finding).`,
              }
            ),
      ]);
    }
    gate.set("changes", view ? "passed" : "skipped", unwritten, { ms: since(changesStarted) });

    const plan = planGateCheck(view ? view.dir : projectDir, testCmd, archCmd);
    // The harness's post-merge gate runs in this working copy too (REQ-186).
    const running = runLockHolder(projectDir);
    if (running && !json && plan.steps.some((st) => st.stage === "tests")) {
      process.stdout.write(
        ui.warn(
          `A harness run (pid ${running.pid}) is working in this project: tests run here now can break its post-merge gate.`
        ) + "\n"
      );
    }

    const validateRun = (asJson: boolean) =>
      spawnSync(
        process.execPath,
        [
          path.join(findCliRoot(__dirname), "bin", "specgate.js"),
          "validate",
          ...plan.steps[0].argv,
          ...(asJson ? ["--json"] : []),
        ],
        { encoding: "utf8" }
      );
    /** Validate's own findings, with the in-flight copy's paths as the project's. */
    const findingsOf = (stdout: string) =>
      validateFindings(stdout).map((d) => {
        const out: Diagnostic = { ...d, message: toProject(d.message) };
        if (d.fix) out.fix = toProject(d.fix);
        if (d.file) out.file = toProject(d.file);
        return out;
      });
    if (!archCmd) gate.set("architecture", "skipped");
    if (plan.testsUnverified) {
      gate.set("tests", "skipped", [
        warning("tests_not_configured", NO_TEST_COMMAND_WARNING.message, {
          fix: 'specgate config set test_cmd "<command>"',
        }),
      ]);
    }

    /** A stage's output, under its line, when it failed. */
    const showFailure = (run: { stdout?: string | null; stderr?: string | null }) => {
      const detail = toProject(`${run.stdout || ""}${run.stderr || ""}`.trim());
      if (!json && detail) {
        process.stdout.write(
          "\n" +
            detail
              .split("\n")
              .map((l) => `     ${l}`)
              .join("\n") +
            "\n\n"
        );
      }
    };
    const archVerdict = (command: string) =>
      error("check_arch_failed", `The gate failed: the architecture check \`${command}\`.`, {
        fix: `Move the code where the architecture expects it, or change the rule on purpose; then run \`specgate check\` again.`,
      });
    const testsVerdict = (
      command: string,
      run?: { stdout?: string | null; stderr?: string | null }
    ) => {
      // recover-guidance REQ-787: name the requirements whose tests are red, and that their code is what to repair.
      const red = run ? failingElsewhere(`${run.stdout || ""}${run.stderr || ""}`, []) : [];
      return red.length
        ? error(
            "check_tests_failed",
            `The gate failed: \`${command}\` — the failing tests name ${red.join(", ")}.`,
            {
              fix: `Repair ${red.join(", ")}'s code so its test passes again — never its test. That is within any change's scope: the design's scope judges new files only. Then run \`specgate check\` again.`,
            }
          )
        : error("check_tests_failed", `The gate failed: \`${command}\`.`, {
            fix: `Make \`${command}\` pass, then run \`specgate check\` again.`,
          });
    };

    // 1. validate --strict, alone: it is the fastest, and it fails fast.
    {
      const started = Date.now();
      progress({ stage: "validate", state: "running" });
      const label = `Specification   ${ui.muted("validate --strict")}`;
      const run = json
        ? validateRun(true)
        : ui.task(
            label,
            () => validateRun(false),
            (r) => ({ ok: r.status === 0 })
          );
      const ms = since(started);
      const ok = run.status === 0;
      // validate's findings: from this run with --json; a person's run read
      // them again as JSON, and only on a failure, to keep them (REQ-504).
      const stageFindings = findingsOf(
        json ? run.stdout : ok && !relaxed ? "" : validateRun(true).stdout
      );
      if (!ok) {
        showFailure(run);
        const verdict = error("check_validate_failed", "The gate failed: validate --strict.", {
          fix: "Fix what validate reports above, then run `specgate check` again.",
        });
        gate.set("validate", "failed", [...stageFindings, verdict], { ms });
        fail(NULL_SHAPE, [...ticketKeys, verdict]);
      }
      gate.set("validate", "passed", stageFindings, { ms });
      // What the policy reports instead of failing: said under the stage.
      if (!json) {
        for (const d of stageFindings.filter((f) => f.code === "gate_rule_reported")) {
          process.stdout.write(`  ${ui.muted(`▲  ${d.message}`)}\n`);
        }
      }
      // One line per relaxed rule in `status`; each finding stays in the stage.
      policyReported.push(...stageFindings.filter((f) => f.code === "gate_rule_reported"));
    }

    // 2. The architecture check and the tests: side by side unless the
    // project says otherwise (REQ-518), each with its own output.
    const archStep = plan.steps.find((st) => st.stage === "arch");
    const testsConfigured = plan.steps.some((st) => st.stage === "tests");
    const testCommand = testsConfigured ? tests.command : null;
    if (!json && affected && testsConfigured) {
      const what =
        selection.mode === "affected"
          ? `${selection.requirements.join(", ")} · ${selection.tests.length} test file(s) since ${selection.base}`
          : `the whole suite — ${selection.reason}`;
      process.stdout.write(`  ${ui.muted(`·  Affected       ${what}`)}\n`);
      for (const d of tests.findings) {
        process.stdout.write(`  ${ui.muted(`·  ${d.message}`)}\n`);
        if (d.fix) process.stdout.write(`     ${ui.muted(`fix: ${d.fix}`)}\n`);
      }
    }
    const runArch = (command: string): Promise<StageRun> => {
      if (!harness.archSarif) return startShell(command, projectDir, "architecture");
      const started = Date.now();
      const r = archRun(projectDir, command, harness.archSarif, baseFlag || "");
      return Promise.resolve({ ...r, ms: since(started) });
    };
    const runTests = (command: string): Promise<StageRun> =>
      startShell(command, projectDir, "tests");
    const archLabel = (command: string) => `Architecture    ${ui.muted(command)}`;
    const testsLabel = (command: string) => `Tests           ${ui.muted(command)}`;

    let archResult: StageRun | null = null;
    let testsResult: StageRun | null = null;
    const parallel = harness.gateParallel !== false && !!archStep && !!testCommand;
    if (parallel && archStep && testCommand) {
      const live = !json && !!process.stdout.isTTY && ui.COLOR > 0;
      if (live) {
        process.stdout.write(
          `  ${c.brand}${ui.ASCII ? "*" : "◌"}${c.reset}  Architecture and tests ${ui.muted("side by side…")}`
        );
      }
      // The tests first: they are the long one, and they write to files.
      const testsRun = runTests(testCommand);
      const archRunning = runArch(archStep.argv[0]);
      [archResult, testsResult] = await Promise.all([archRunning, testsRun]);
      if (live) process.stdout.write("\r\x1b[2K");
      if (!json) {
        process.stdout.write(
          ui.stageLine(archLabel(archStep.argv[0]), archResult.status === 0, archResult.ms) +
            ui.stageLine(testsLabel(testCommand), testsResult.status === 0, testsResult.ms)
        );
      }
    } else {
      if (archStep) {
        const exec = () => {
          const started = Date.now();
          const r = harness.archSarif
            ? archRun(projectDir, archStep.argv[0], harness.archSarif, baseFlag || "")
            : runLogged("architecture", forShell(archStep.argv[0]), projectDir);
          return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms: since(started) };
        };
        archResult = json
          ? exec()
          : ui.task(archLabel(archStep.argv[0]), exec, (r) => ({ ok: r.status === 0 }));
      }
      if (testCommand && (!archResult || archResult.status === 0)) {
        const exec = () => {
          const started = Date.now();
          const r = runLogged("tests", forShell(testCommand), projectDir);
          return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms: since(started) };
        };
        testsResult = json
          ? exec()
          : ui.task(testsLabel(testCommand), exec, (r) => ({ ok: r.status === 0 }));
      }
    }

    const verdicts: Diagnostic[] = [];
    if (archStep && archResult) {
      if (archResult.status === 0) {
        gate.set("architecture", "passed", [], { ms: archResult.ms });
      } else {
        if (!json) showFailure(archResult);
        const verdict = archVerdict(archStep.argv[0]);
        gate.set("architecture", "failed", [verdict], { ms: archResult.ms });
        verdicts.push(verdict);
      }
    }
    if (testsResult && testCommand) {
      tests.done(testsResult.status === 0);
      if (testsResult.status === 0) {
        gate.set("tests", "passed", tests.findings, { ms: testsResult.ms, command: testCommand });
      } else {
        if (!json) showFailure(testsResult);
        const verdict = testsVerdict(testCommand, testsResult);
        gate.set("tests", "failed", [...tests.findings, verdict], {
          ms: testsResult.ms,
          command: testCommand,
        });
        verdicts.push(verdict);
      }
    } else if (testsConfigured && !testCommand && verdicts.length === 0) {
      // REQ-516: every selected test passed before on the same code.
      gate.set("tests", "passed", tests.findings, { ms: null, command: null });
      if (!json) {
        process.stdout.write(
          ui.ok(
            `Tests           ${ui.muted(`${selection.cached.length} test file(s) cached — passed before on the same code`)}`
          )
        );
      }
    }
    if (verdicts.length > 0) fail(NULL_SHAPE, [...ticketKeys, ...verdicts]);

    // gate-runs-scenarios REQ-734: with executable scenarios required, those of
    // every delivered requirement — code changed after its delivery is judged too.
    const scenariosCmd = scenariosRequired(projectDir) ? scenarioCommand(projectDir) : "";
    if (scenariosCmd && noScenarios) {
      gate.set("scenarios", "skipped", [
        info("check_scenarios_skipped", "The scenarios were not run: --no-scenarios.", {
          target: "scenarios",
        }),
      ]);
      if (!json)
        process.stdout.write(`  ${ui.muted("·  Scenarios       not run — --no-scenarios")}\n`);
    } else if (scenariosCmd) {
      const delivered = deliveredWithFeature(projectDir);
      const startedScenarios = Date.now();
      progress({ stage: "scenarios", state: "running" });
      const broken: Diagnostic[] = [];
      for (const id of delivered) {
        const v = runRequirementScenarios(projectDir, id, scenariosCmd);
        if (v.ok) continue;
        broken.push(
          error(
            "check_scenarios_failed",
            `${id}'s scenarios did not pass${v.failed.length ? `: ${v.failed.join(", ")}` : ""} — ran ${v.command}`,
            {
              target: id,
              fix: `make the code do what ${v.failed.length ? v.failed.join(", ") : `${id}'s scenarios`} say${v.failed.length === 1 ? "s" : ""}: specgate scenarios ${id}`,
            }
          )
        );
      }
      const ms = Date.now() - startedScenarios;
      if (broken.length > 0) {
        const verdict = error(
          "check_scenarios_failed",
          `The gate failed: the scenarios of ${broken.length} delivered requirement(s).`,
          {
            target: "scenarios",
            fix: "specgate scenarios <REQ> runs one requirement's, scenario by scenario",
          }
        );
        gate.set("scenarios", "failed", [...broken, verdict], { ms });
        if (!json)
          process.stdout.write(
            ui.fail(
              `Scenarios       ${delivered.length} delivered requirement(s), ${broken.length} failing`
            )
          );
        fail(NULL_SHAPE, [...ticketKeys, ...broken, verdict]);
      }
      gate.set("scenarios", "passed", [], { ms });
      if (!json && delivered.length > 0)
        process.stdout.write(
          ui.ok(`Scenarios       ${ui.muted(`${delivered.length} delivered requirement(s)`)}`)
        );
    }

    // sealed-acceptance REQ-759: the acceptance tests a person approved, run
    // with the project's own command — red is red, and the fix is in the code.
    const acceptance = acceptanceRun(projectDir);
    if (acceptance.ran || acceptance.errors.length || acceptance.warnings.length) {
      const findings = [...acceptance.errors, ...acceptance.warnings];
      if (acceptance.errors.length > 0) {
        gate.set("acceptance", "failed", findings, {
          ms: acceptance.ms,
          command: acceptance.command || null,
        });
        if (!json) process.stdout.write(ui.fail(`Acceptance      ${acceptance.errors[0]!.code}`));
        const verdict = error(
          "check_acceptance_failed",
          "The gate failed: the sealed acceptance tests.",
          {
            target: "acceptance",
            fix: acceptance.errors.find((d) => d.fix)?.fix || "specgate check",
          }
        );
        fail(NULL_SHAPE, [...ticketKeys, ...acceptance.errors, verdict]);
      }
      gate.set("acceptance", acceptance.ran ? "passed" : "skipped", findings, {
        ms: acceptance.ms,
        command: acceptance.command || null,
      });
      if (!json) {
        if (acceptance.ran)
          process.stdout.write(ui.ok(`Acceptance      ${ui.muted(acceptance.command)}`));
        for (const w of acceptance.warnings)
          process.stdout.write(`  ${ui.muted(`·  Acceptance     ${w.message}`)}\n`);
      }
    }

    // ADR-0040: the team's quality and security checks, after the tests. The
    // `attempt` and `end` stages always; `ci` with --ci.
    const quality = harness.quality;
    const outcomes: CheckOutcome[] = [];
    const qualityLevel = levelOf(policy, "quality");
    if (quality && quality.checks.length > 0 && qualityLevel === "off") {
      if (!json) {
        process.stdout.write(
          `  ${ui.muted(`·  Quality        not run — quality is off in ${GATE_POLICY_FILE}`)}\n`
        );
      }
    } else if (quality && quality.checks.length > 0) {
      const ctx = gateContext(projectDir, "", baseFlag || "");
      const stages: Stage[] = ci ? ["attempt", "end", "ci"] : ["attempt", "end"];
      outcomes.push(
        ...runStages(projectDir, quality, stages, ctx, (check, run) => {
          const label = `Quality         ${check.name} ${ui.muted(check.runner === "docker" ? check.image.split("@")[0] : check.run.split(/\s+/)[0])}`;
          const o = json
            ? run()
            : ui.task(label, run, (x) => ({ ok: x.ok || !!x.skipped || !x.gate }));
          const [result, findings] = qualityStage(o);
          gate.set("quality", result, findings, {
            name: check.name,
            command: o.command || check.run,
            ms: o.skipped ? null : o.ms,
          });
          if (!json && o.skipped) {
            process.stdout.write(`  ${ui.muted(`   ${check.name}: not run — ${o.skipped}`)}\n`);
          } else if (!json && !o.ok && o.output) {
            process.stdout.write(
              "\n" +
                toProject(o.output)
                  .split("\n")
                  .map((l) => `     ${l}`)
                  .join("\n") +
                "\n\n"
            );
          }
          return o;
        })
      );
      if (!stagesPassed(outcomes, ci) && qualityLevel === "warning") {
        const failed = outcomes.filter((o) => o.gate && (o.skipped ? ci : !o.ok));
        const reported = warning(
          "gate_rule_reported",
          `${failed.length} quality check(s) reported, not failed: ${failed.map((o) => o.name).join(", ")} — ${GATE_POLICY_FILE} sets quality to warning.`,
          {
            target: "quality",
            fix: `Fix them, or set \`quality: error\` in ${GATE_POLICY_FILE} once they pass.`,
          }
        );
        policyReported.push(reported);
        if (!json) process.stdout.write(`  ${ui.muted(`▲  ${reported.message}`)}\n`);
      } else if (!stagesPassed(outcomes, ci)) {
        const failed = outcomes.filter((o) => o.gate && (o.skipped ? ci : !o.ok));
        fail({ check: { quality: outcomes.map(({ output: _o, ...rest }) => rest) } }, [
          ...ticketKeys,
          error(
            "check_quality_failed",
            `The gate failed: ${failed.map((o) => o.name).join(", ")}.`,
            {
              fix: failed.some((o) => o.skipped)
                ? `In CI every check must run: ${failed
                    .filter((o) => o.skipped)
                    .map((o) => `${o.name} — ${o.skipped}`)
                    .join("; ")}`
                : "Fix what the checks report above, then run `specgate check` again.",
            }
          ),
        ]);
      }
    }

    // Name the command the build files give away: adoption printed "Test
    // command: npm test", and this warning then said none was configured
    // without saying which one, or how (reservas_app, #44).
    const detected = plan.testsUnverified ? detectTestCommand(projectDir) : null;
    const fixLines = detected
      ? [
          `This project's test command looks like \`${detected}\`. Configure it once:`,
          `  specgate config set test_cmd "${detected}"`,
          `or pass --test-cmd "${detected}". Until then, nothing here runs your tests.`,
        ]
      : NO_TEST_COMMAND_WARNING.fix;
    const status = [
      ...tests.findings,
      ...(plan.testsUnverified
        ? [
            warning("tests_not_configured", NO_TEST_COMMAND_WARNING.message, {
              fix: fixLines.join(" "),
            }),
          ]
        : []),
      ...unwritten,
      ...ticketKeys,
      ...idWarnings,
      ...policyReported,
    ];
    recordCheck(projectDir, true);
    recordLastCheck(projectDir, { passed: true, ci, stages: gate.list(), status, selection });
    io.emit(
      {
        stages: gate.list(),
        selection,
        check: {
          validate: "passed",
          architecture: archCmd ? "passed" : "not_configured",
          archCommand: archCmd || null,
          tests: plan.testsUnverified ? "not_configured" : "passed",
          ids: ids.state === "checked" ? `compared with ${ids.base}` : `skipped: ${ids.reason}`,
          testCommand: plan.testsUnverified ? null : testCmd,
          quality: outcomes.map(({ output: _o, ...rest }) => rest),
          principles: steer.principles,
          drift: { mode: driftMode, commits: drift.commits.length },
        },
        status,
      },
      () => {
        // Not a warning: most projects have no architecture tool, and the gate
        // is complete without one. It is said, so nobody reads the pass as one.
        if (!archCmd) {
          process.stdout.write(
            `  ${ui.muted(`·  Architecture    not checked — specgate config set arch_cmd "<command>"`)}\n`
          );
        }
        if (plan.testsUnverified) {
          process.stdout.write(
            ui.warn(`Tests           ${ui.muted("not configured")}`) +
              `\n  ${c.warn}${NO_TEST_COMMAND_WARNING.message}${c.reset}\n` +
              fixLines.map((l) => `  ${ui.muted(l)}\n`).join("") +
              `\n  ${c.ok}${ui.sym.ok}  ${c.bold}Gate passed${c.reset} ${ui.muted(`— the specification${archCmd ? " and the architecture" : ""}`)}\n\n`
          );
        } else {
          process.stdout.write(
            `\n  ${c.ok}${ui.sym.ok}  ${c.bold}Gate passed${c.reset} ${ui.muted(`— the specification${archCmd ? ", the architecture" : ""} and \`${testCmd}\``)}\n\n`
          );
        }
      }
    );
  }
}
