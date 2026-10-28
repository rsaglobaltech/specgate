import { detectTestCommand } from "../../../harness/init";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveProjectDir, findCliRoot } from "../../../lib/project-root";
import { error, warning } from "../../../lib/diagnostics";
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
import { gateContext, runStages, stagesPassed, type CheckOutcome } from "../../../lib/quality-run";
import type { Stage } from "../../../../packages/core/src/domain/QualityChecks";

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--base <branch>] [--ci] [--json]

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

  Exit 0 green · 1 the gate failed · 2 usage error.

`
  );
}

/**
 * `specgate check` — one name for the gate.
 *
 * The team feedback was that the tool is hard to absorb, and the gate was a
 * good example: `validate` plus a choice of five `--strict-*` flags, and the
 * suite run by a different command. This is that whole decision, made once.
 */
export class CheckCommand extends BaseCommand {
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
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--ci") {
        ci = true;
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
      recordCheck(projectDir, false);
      const first = ids.collisions[0];
      io.fail(NULL_SHAPE, [
        ...ticketKeys,
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
      ]);
    }
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
      recordCheck(projectDir, false);
      const first = view.problems[0].change;
      io.fail(NULL_SHAPE, [
        ...ticketKeys,
        // One fix line per refusal: the findings say what, the last says how.
        ...view.problems.map(({ fix: _fix, change: _change, ...d }) => d),
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

    const harness: Partial<HarnessSettings> = readHarnessConfig(projectDir) || {};
    const testCmd = testCmdFlag !== undefined ? testCmdFlag : harness.testCmd;
    const archCmd = (harness.archCmd || "").trim();
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

    for (const step of plan.steps) {
      const exec = () =>
        step.stage === "validate"
          ? spawnSync(
              process.execPath,
              [path.join(findCliRoot(__dirname), "bin", "specgate.js"), "validate", ...step.argv],
              { encoding: "utf8" }
            )
          : spawnSync(step.argv[0], { cwd: projectDir, encoding: "utf8", shell: true });
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
      if (run.status === 0) continue;

      recordCheck(projectDir, false);
      io.fail(NULL_SHAPE, [
        ...ticketKeys,
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
              }),
      ]);
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
        recordCheck(projectDir, false);
        const failed = outcomes.filter((o) => o.gate && (o.skipped ? ci : !o.ok));
        io.fail({ check: { quality: outcomes.map(({ output: _o, ...rest }) => rest) } }, [
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
    io.emit(
      {
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
