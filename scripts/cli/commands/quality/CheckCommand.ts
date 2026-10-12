import { detectTestCommand } from "../../../harness/init";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveProjectDir, findCliRoot } from "../../../lib/project-root";
import { error, warning } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import {
  planGateCheck,
  NO_TEST_COMMAND_WARNING,
} from "../../../../packages/core/src/domain/DoneVerification";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";

import { c } from "../../../lib/ui";
import * as ui from "../../../lib/ui";
import { recordCheck } from "../../../pet/pet";

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--json]

  The gate — what to run before a pull request:
    1. validate --strict   specs, scenarios, traceability, links and coverage
    2. your architecture   arch_cmd: in harness.config.yaml (ArchUnit, …), if set
    3. your tests          from --test-cmd, or test_cmd: in harness.config.yaml

  Without a test command it still passes, and says it checked the
  specification, not the code.

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
    const io = agentIo(json);

    let testCmdFlag: string | undefined;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--test-cmd") {
        testCmdFlag = argv[++i];
        if (testCmdFlag === undefined) {
          io.usage(NULL_SHAPE, [
            error("missing_value", "--test-cmd needs a command.", {
              fix: 'specgate check --test-cmd "npm test"',
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

    const harness = readHarnessConfig(projectDir) || ({} as any);
    const testCmd = testCmdFlag !== undefined ? testCmdFlag : harness.testCmd;
    const archCmd = (harness.archCmd || "").trim();
    const plan = planGateCheck(projectDir, testCmd, archCmd);

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

      const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
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
    const status = plan.testsUnverified
      ? [
          warning("tests_not_configured", NO_TEST_COMMAND_WARNING.message, {
            fix: fixLines.join(" "),
          }),
        ]
      : [];
    recordCheck(projectDir, true);
    io.emit(
      {
        check: {
          validate: "passed",
          architecture: archCmd ? "passed" : "not_configured",
          archCommand: archCmd || null,
          tests: plan.testsUnverified ? "not_configured" : "passed",
          testCommand: plan.testsUnverified ? null : testCmd,
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
