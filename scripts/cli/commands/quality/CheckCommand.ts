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

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
};

const NULL_SHAPE = { check: null };

function usage(): void {
  process.stdout.write(
    `
  ✅ ${c.bold}specgate check${c.reset} [dir] [--test-cmd "<command>"] [--json]

  The gate — what to run before a pull request:
    1. validate --strict   specs, scenarios, traceability, links and coverage
    2. your tests          from --test-cmd, or test_cmd: in harness.config.yaml

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

    const harness = readHarnessConfig(projectDir) || ({} as any);
    const testCmd = testCmdFlag !== undefined ? testCmdFlag : harness.testCmd;
    const plan = planGateCheck(projectDir, testCmd);

    for (const step of plan.steps) {
      const run =
        step.stage === "validate"
          ? spawnSync(
              process.execPath,
              [path.join(findCliRoot(__dirname), "bin", "specgate.js"), "validate", ...step.argv],
              { encoding: "utf8" }
            )
          : spawnSync(step.argv[0], { cwd: projectDir, encoding: "utf8", shell: true });

      const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
      if (!json && detail) process.stdout.write(`${detail}\n\n`);
      if (run.status === 0) continue;

      io.fail(NULL_SHAPE, [
        step.stage === "validate"
          ? error("check_validate_failed", "The gate failed: validate --strict.", {
              fix: "Fix what validate reports above, then run `specgate check` again.",
            })
          : error("check_tests_failed", `The gate failed: \`${step.argv[0]}\`.`, {
              fix: `Make \`${step.argv[0]}\` pass, then run \`specgate check\` again.`,
            }),
      ]);
    }

    const status = plan.testsUnverified
      ? [
          warning("tests_not_configured", NO_TEST_COMMAND_WARNING.message, {
            fix: NO_TEST_COMMAND_WARNING.fix.join(" "),
          }),
        ]
      : [];
    io.emit(
      {
        check: {
          validate: "passed",
          tests: plan.testsUnverified ? "not_configured" : "passed",
          testCommand: plan.testsUnverified ? null : testCmd,
        },
        status,
      },
      () => {
        if (plan.testsUnverified) {
          process.stdout.write(
            `${c.yellow}⚠${c.reset}  ${NO_TEST_COMMAND_WARNING.message}\n` +
              NO_TEST_COMMAND_WARNING.fix.map((l) => `   ${c.dim}${l}${c.reset}\n`).join("") +
              `\n${c.green}✔${c.reset}  ${c.bold}Gate passed${c.reset} ${c.dim}— the specification${c.reset}\n`
          );
        } else {
          process.stdout.write(
            `${c.green}✔${c.reset}  ${c.bold}Gate passed${c.reset} ${c.dim}— the specification and \`${testCmd}\`${c.reset}\n`
          );
        }
      }
    );
  }
}
