import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, EXIT } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { UpdateRequirementStatusUseCase } from "../../../../packages/core/src/application/UpdateRequirementStatusUseCase";
import {
  planDoneVerification,
  NO_TEST_COMMAND_WARNING,
} from "../../../../packages/core/src/domain/DoneVerification";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { findCliRoot } from "../../../lib/project-root";

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
};

export const ALLOWED_STATUSES = [
  "Draft",
  "Approved",
  "Implemented",
  "Verified",
  "Released",
  "Deprecated",
];

export interface DoneOptions {
  reqId: string | null;
  status: string;
  projectDir: string;
  check: boolean;
  strict: boolean;
  /** Overrides `test_cmd:` in harness.config.yaml for this invocation. */
  testCmd?: string;
  json?: boolean;
}

export function parseArgs(argv: string[]): DoneOptions {
  const opts: DoneOptions = {
    reqId: null,
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
    else if (a === "--test-cmd" && argv[i + 1]) opts.testCmd = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--strict") {
      opts.strict = true;
      opts.check = true;
    } else if (!opts.reqId && !a.startsWith("-")) {
      opts.reqId = a;
    }
  }
  return opts;
}

export class DoneCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    const io = agentIo(opts.json);
    const NULL_SHAPE = { requirement: null };

    // Before the required-argument check: `done --help` used to answer
    // "REQ-id is required", which is a usage error in response to a question.
    if (this.args.includes("--help") || this.args.includes("-h")) {
      process.stdout.write(
        "Usage:\n" +
          "  specgate done <REQ-id> [--status <Status>] [--check] [--strict]\n" +
          '                       [--test-cmd "<command>"] [--project-dir <path>] [--json]\n\n' +
          "Marks a requirement's row in docs/specs/traceability.md.\n\n" +
          "Options:\n" +
          `  --status <Status>   Target status (default: Implemented).\n` +
          `                      One of: ${ALLOWED_STATUSES.join(", ")}\n` +
          "  --check             Run `validate` first and refuse to write if it fails.\n" +
          "  --strict            --check with the gate: validate --strict.\n" +
          '  --test-cmd "<cmd>"  Also run the project\'s tests and require them to pass.\n' +
          "                      Read from `test_cmd:` in harness.config.yaml when omitted.\n" +
          "                      Without one, `done` says it checked the specification\n" +
          "                      and not the code, rather than reporting a pass.\n" +
          "  --project-dir <p>   Project root (auto-detected from cwd if omitted).\n" +
          "  --json              Emit one JSON document on stdout.\n"
      );
      process.exit(EXIT.OK);
    }

    if (!opts.reqId) {
      io.usage(NULL_SHAPE, [
        error("req_id_required", "REQ-id is required (e.g. REQ-007).", {
          fix: "Pass the requirement id: specgate done REQ-007",
        }),
      ]);
    }
    if (!/^REQ-\d+$/.test(opts.reqId!)) {
      io.usage(NULL_SHAPE, [
        error("req_id_malformed", `Invalid REQ-id: ${opts.reqId} (expected REQ-NNN).`, {
          target: opts.reqId!,
          fix: "Use the REQ-NNN form, e.g. REQ-007.",
        }),
      ]);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err: any) {
      io.usage(NULL_SHAPE, [
        error("project_not_found", err.message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }

    // ── The checks, before anything is written ───────────────────────────────
    //
    // `--check` and `--strict` used to be parsed and discarded, so `done
    // REQ-001 --check` printed a tick over a matrix pointing at files that do
    // not exist. Four documentation pages said it "validates first".
    const harness = readHarnessConfig(projectDir) || ({} as any);
    const plan = planDoneVerification(projectDir, {
      check: opts.check,
      strict: opts.strict,
      reqId: opts.reqId || undefined,
      testCmd: opts.testCmd || harness.testCmd,
    });

    for (const step of plan.steps) {
      const run =
        step.stage === "validate"
          ? spawnSync(
              process.execPath,
              [path.join(findCliRoot(__dirname), "bin", "specgate.js"), "validate", ...step.argv],
              { encoding: "utf8" }
            )
          : spawnSync(step.argv[0], {
              cwd: projectDir,
              encoding: "utf8",
              shell: true,
            });

      if (run.status === 0) continue;

      // The output is the evidence, and it goes out *before* the diagnostic:
      // `io.fail` never returns, so anything written after it is dead code.
      const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
      if (detail && !opts.json) process.stderr.write(`${detail}\n\n`);

      io.fail(NULL_SHAPE, [
        error(
          step.stage === "validate" ? "done_validate_failed" : "done_tests_failed",
          step.stage === "validate"
            ? `not marked ${opts.status}: validation failed.`
            : `not marked ${opts.status}: the project's tests failed.`,
          {
            target: opts.reqId!,
            fix:
              step.stage === "validate"
                ? "Fix what validate reports, then run `done` again."
                : `Make \`${step.argv[0]}\` pass, then run \`done\` again. A requirement ` +
                  `marked Implemented over a red suite is the claim this gate exists to stop.`,
          }
        ),
      ]);
    }

    const repo = new DiskTraceabilityRepository();
    const useCase = new UpdateRequirementStatusUseCase(repo);
    const result = useCase.execute(projectDir, opts.reqId!, opts.status);

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
            result.error || `${opts.reqId} not found in traceability.md.`,
            {
              target: opts.reqId!,
              fix: `Add a row for ${opts.reqId} — \`specgate req add\` writes one for you.`,
            }
          ),
        ]);
      }
    }

    const updated = result.updated;
    io.emit({ requirement: { id: opts.reqId, status: opts.status, rowsUpdated: updated } }, () =>
      process.stdout.write(
        `${c.green}✔${c.reset}  ${c.bold}${opts.reqId}${c.reset} → ${c.bold}${opts.status}${c.reset} ${c.dim}(${updated} row${updated > 1 ? "s" : ""} updated)${c.reset}\n`
      )
    );

    // Said out loud, after the tick, because this is the command that writes
    // `Implemented` into the record other people read. A project nothing ran is
    // not a project that passed.
    if (plan.testsUnverified && !opts.json) {
      process.stderr.write(`${c.yellow}⚠${c.reset}  ${NO_TEST_COMMAND_WARNING.message}\n`);
      for (const line of NO_TEST_COMMAND_WARNING.fix) {
        process.stderr.write(`   ${c.dim}${line}${c.reset}\n`);
      }
    }

    process.exit(EXIT.OK);
  }
}
