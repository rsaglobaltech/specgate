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
import type { Diagnostic } from "../../../lib/diagnostics";

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--base <branch>] [--ci] [--json]
  ✅ ${c.bold}specgate check --last${c.reset} [dir] [--json]   the last gate result, without running it

  The gate — what to run before a pull request:
    1. validate --strict   specs, scenarios, traceability, links and coverage
    2. your architecture   arch_cmd: in harness.config.yaml (ArchUnit, …), if set
    3. your tests          from --test-cmd, or test_cmd: in harness.config.yaml
    4. your quality checks checks: in harness.config.yaml — attempt and end;
                           --ci adds the ci ones, and a check that cannot run fails

  Without a test command it still passes, and says it checked the
  specification, not the code.

  Requirement ids are compared with the base branch (--base, SPECGATE_BASE,
  pr.base in alm.config.yaml, or origin's default): the same id with another title there fails the gate
  before the merge. Skipped, and said, without git or a base to read.

  With --json, every answer lists the gate's stages — ids, changes, validate,
  architecture, tests, each quality check — with its command, its result
  (passed, failed, skipped, not run) and its findings. Each check keeps its
  result in the repository's git folder; --last reads it back.

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

  public execute(): void {
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
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--ci") {
        ci = true;
      } else if (a === "--last") {
        last = true;
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
    const plannedTests = gateTestCommand((testCmd || "").trim());
    const gate = new GateStages({
      archCmd: archCmd || null,
      testCmd: plannedTests || null,
      checks: harness.quality ? checksFor(harness.quality, qualityStages) : [],
    });
    /** Fail the gate: keep the result, then answer with every stage. */
    const fail = (payload: { check: unknown }, diags: Diagnostic[]): never => {
      recordCheck(projectDir, false);
      recordLastCheck(projectDir, { passed: false, ci, stages: gate.list(), status: diags });
      return io.fail({ ...payload, stages: gate.list() }, diags);
    };

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
      gate.set("ids", "failed", collisions);
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
          ]
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
      gate.set("changes", "failed", problems);
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
    gate.set("changes", view ? "passed" : "skipped", unwritten);

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

    for (const step of plan.steps) {
      const exec = () =>
        step.stage === "validate"
          ? validateRun(json)
          : step.stage === "arch" && harness.archSarif
            ? archRun(projectDir, step.argv[0], harness.archSarif, baseFlag || "")
            : spawnSync(forShell(step.argv[0]), { cwd: projectDir, encoding: "utf8", shell: true });
      // One line per stage, replaced by how it ended. What a stage printed is
      // shown only when it failed: on a pass it was a screen of noise between
      // the person and the verdict.
      const label =
        step.stage === "validate"
          ? `Specification   ${ui.muted("validate --strict")}`
          : step.stage === "arch"
            ? `Architecture    ${ui.muted(step.argv[0])}`
            : `Tests           ${ui.muted(step.argv[0])}`;
      const run = json ? exec() : ui.task(label, exec, (r) => ({ ok: r.status === 0 }));
      const stageName =
        step.stage === "validate" ? "validate" : step.stage === "arch" ? "architecture" : "tests";
      const ok = run.status === 0;
      // validate's findings: from this run with --json; a person's run read
      // them again as JSON, and only on a failure, to keep them (REQ-504).
      const stageFindings =
        step.stage === "validate"
          ? findingsOf(json ? run.stdout : ok ? "" : validateRun(true).stdout)
          : [];

      const detail = toProject(`${run.stdout || ""}${run.stderr || ""}`.trim());
      if (!json && detail && run.status !== 0) {
        process.stdout.write(
          "\n" +
            detail
              .split("\n")
              .map((l) => `     ${l}`)
              .join("\n") +
            "\n\n"
        );
      }
      if (ok) {
        gate.set(stageName, "passed", stageFindings);
        continue;
      }

      const verdict =
        step.stage === "validate"
          ? error("check_validate_failed", "The gate failed: validate --strict.", {
              fix: "Fix what validate reports above, then run `specgate check` again.",
            })
          : step.stage === "arch"
            ? error(
                "check_arch_failed",
                `The gate failed: the architecture check \`${step.argv[0]}\`.`,
                {
                  fix: `Move the code where the architecture expects it, or change the rule on purpose; then run \`specgate check\` again.`,
                }
              )
            : error("check_tests_failed", `The gate failed: \`${step.argv[0]}\`.`, {
                fix: `Make \`${step.argv[0]}\` pass, then run \`specgate check\` again.`,
              });
      gate.set(stageName, "failed", [...stageFindings, verdict]);
      fail(NULL_SHAPE, [...ticketKeys, verdict]);
    }

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
    recordLastCheck(projectDir, { passed: true, ci, stages: gate.list(), status });
    io.emit(
      {
        stages: gate.list(),
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
