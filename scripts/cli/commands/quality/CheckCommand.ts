import { detectTestCommand } from "../../../harness/init";
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
import type { HarnessSettings } from "../../../../packages/core/src/domain/HarnessConfig";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";
import { inFlightView, unwrittenNotes } from "../../../lib/in-flight";
import { checkIdsAgainstBase } from "../../../lib/base-ids";
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
import { GateStages, validateFindings } from "../../../lib/gate-stages";
import { lastCheckAnswer, recordLastCheck } from "../../../lib/last-check";
import { checksFor } from "../../../../packages/core/src/domain/QualityChecks";
import { gateTestCommand } from "../../../../packages/core/src/domain/DoneVerification";
import { planTests } from "../../../lib/test-selection";
import { startShell, type StageRun } from "../../../lib/stage-run";
import type { Diagnostic } from "../../../lib/diagnostics";

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--base <branch>] [--ci] [--json]
  ✅ ${c.bold}specgate check --affected${c.reset} [dir] [--base <ref>] [--no-cache]   only what the change touches
  ✅ ${c.bold}specgate check --last${c.reset} [dir] [--json]   the last gate result, without running it

  The gate — what to run before a pull request:
    1. validate --strict   specs, scenarios, traceability, links and coverage
    2. your architecture   arch_cmd: in harness.config.yaml (ArchUnit, …), if set
    3. your tests          from --test-cmd, or test_cmd: in harness.config.yaml
                           (2 and 3 run side by side; gate_parallel: false runs
                           them one after the other)
    4. your quality checks checks: in harness.config.yaml — attempt and end;
                           --ci adds the ci ones, and a check that cannot run fails

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
  architecture, tests, each quality check — with its command, its result
  (passed, failed, skipped, not run), its ms and its findings, and the
  selection of tests it ran: mode (affected or full), reason, base, changed,
  requirements, tests, cached and command. Each check keeps its result in the
  repository's git folder; --last reads it back.

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
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--ci") {
        ci = true;
      } else if (a === "--last") {
        last = true;
      } else if (a === "--affected") {
        affected = true;
      } else if (a === "--no-cache") {
        noCache = true;
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

    // REQ-503: every stage, planned up front and set as the gate reaches it,
    // so a failed gate still says what passed before it and what never ran.
    const harness: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    const testCmd = testCmdFlag !== undefined ? testCmdFlag : harness.testCmd;
    const archCmd = (harness.archCmd || "").trim();
    const qualityStages: Stage[] = ci ? ["attempt", "end", "ci"] : ["attempt", "end"];
    // REQ-510 … REQ-516: which tests run — the whole suite, or what the change
    // touches — and the command that runs them; said in every answer.
    const tests = planTests(projectDir, {
      affected,
      ci,
      noCache,
      base: baseFlag || prBase(projectDir) || undefined,
      testCmd: testCmdFlag,
      harness,
    });
    const selection = tests.selection;
    const plannedTests = tests.command ?? gateTestCommand((testCmd || "").trim());
    const gate = new GateStages({
      archCmd: archCmd || null,
      testCmd: plannedTests || null,
      checks: harness.quality ? checksFor(harness.quality, qualityStages) : [],
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

    // On a ticket's branch, commits that do not name the ticket (ADR-0039);
    // and requirements another open change rewrites too (REQ-160).
    // Said whatever the gate decides: a failed gate is fixed on the same branch.
    const ticketKeys = [
      ...ticketKeyFindings(projectDir, baseFlag),
      ...changeOverlaps(projectDir),
      ...changeBaseFindings(projectDir, baseFlag),
    ];
    // After the comparison, so the first sight of a change records, not warns (REQ-168).
    recordBases(projectDir);
    if (!json) {
      for (const d of ticketKeys) process.stdout.write(ui.warn(d.message) + ui.fix(d.fix ?? ""));
    }

    // Two branches allocate ids as max+1 over their own checkout; the
    // collision is caught here, before the merge (ADR-0036). Against the same
    // base as ticket keys: a gitflow project's `pr: base:` (REQ-120).
    const idsStarted = Date.now();
    const ids = checkIdsAgainstBase(
      projectDir,
      baseFlag || process.env.SPECGATE_BASE || prBase(projectDir) || undefined
    );
    if (ids.state === "checked" && ids.collisions.length > 0) {
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
    gate.set(
      "ids",
      ids.state === "checked" ? "passed" : "skipped",
      ids.state === "checked"
        ? []
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
    const unwritten = unwrittenNotes(projectDir);
    if (!json) {
      for (const n of unwritten) {
        process.stdout.write(
          `  ${ui.muted(`·  Change          ${n.target} — delta not written yet, not judged until it is`)}\n`
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
      fail(NULL_SHAPE, [
        ...ticketKeys,
        ...problems,
        error(
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
    const testsVerdict = (command: string) =>
      error("check_tests_failed", `The gate failed: \`${command}\`.`, {
        fix: `Make \`${command}\` pass, then run \`specgate check\` again.`,
      });

    // 1. validate --strict, alone: it is the fastest, and it fails fast.
    {
      const started = Date.now();
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
      const stageFindings = findingsOf(json ? run.stdout : ok ? "" : validateRun(true).stdout);
      if (!ok) {
        showFailure(run);
        const verdict = error("check_validate_failed", "The gate failed: validate --strict.", {
          fix: "Fix what validate reports above, then run `specgate check` again.",
        });
        gate.set("validate", "failed", [...stageFindings, verdict], { ms });
        fail(NULL_SHAPE, [...ticketKeys, verdict]);
      }
      gate.set("validate", "passed", stageFindings, { ms });
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
      if (!harness.archSarif) return startShell(command, projectDir);
      const started = Date.now();
      const r = archRun(projectDir, command, harness.archSarif, baseFlag || "");
      return Promise.resolve({ ...r, ms: since(started) });
    };
    const runTests = (command: string): Promise<StageRun> => startShell(command, projectDir);
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
            : spawnSync(forShell(archStep.argv[0]), {
                cwd: projectDir,
                encoding: "utf8",
                shell: true,
              });
          return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms: since(started) };
        };
        archResult = json
          ? exec()
          : ui.task(archLabel(archStep.argv[0]), exec, (r) => ({ ok: r.status === 0 }));
      }
      if (testCommand && (!archResult || archResult.status === 0)) {
        const exec = () => {
          const started = Date.now();
          const r = spawnSync(forShell(testCommand), {
            cwd: projectDir,
            encoding: "utf8",
            shell: true,
          });
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
        const verdict = testsVerdict(testCommand);
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

    // ADR-0040: the team's quality and security checks, after the tests. The
    // `attempt` and `end` stages always; `ci` with --ci.
    const quality = harness.quality;
    const outcomes: CheckOutcome[] = [];
    if (quality && quality.checks.length > 0) {
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
      if (!stagesPassed(outcomes, ci)) {
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
