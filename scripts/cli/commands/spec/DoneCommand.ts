import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, EXIT } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { UpdateRequirementStatusUseCase } from "../../../../packages/core/src/application/UpdateRequirementStatusUseCase";
import {
  planDoneVerification,
  deliveryBlocker,
  NO_TEST_COMMAND_WARNING,
} from "../../../../packages/core/src/domain/DoneVerification";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { findCliRoot } from "../../../lib/project-root";
import { isDerivedProject, writeRequirementFields } from "../../../lib/derived-writes";
import { refreshDerivedMatrix } from "./MatrixCommand";

import { c } from "../../../lib/ui";
import * as ui from "../../../lib/ui";

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
  public execute(): void {
    const opts = parseArgs(this.args);
    const io = agentIo(opts.json);
    const NULL_SHAPE = { requirement: null };

    // Before the required-argument check: `done --help` used to answer
    // "REQ-id is required", which is a usage error in response to a question.
    if (this.args.includes("--help") || this.args.includes("-h")) {
      process.stdout.write(
        "Usage:\n" +
          "  specgate done <REQ-id> [<REQ-id> …] [--status <Status>] [--no-check]\n" +
          '                       [--test-cmd "<command>"] [--project-dir <path>] [--json]\n\n' +
          "Marks a requirement delivered — after the gate `specgate check` runs passes\n" +
          "for it. Nothing is written when it fails. Several ids are checked one by one\n" +
          "and the project's tests run once for all of them.\n\n" +
          "Options:\n" +
          `  --status <Status>   Target status (default: Implemented).\n` +
          `                      One of: ${ALLOWED_STATUSES.join(", ")}\n` +
          "  --no-check          Write the status without running the gate (Implemented,\n" +
          "                      Verified and Released run it by default).\n" +
          "  --check, --strict   Run the gate for any status, Approved included.\n" +
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
    if (opts.reqIds.length > 1) return this.executeMany(opts, io);
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
    // A test written since the last regeneration is new evidence: bring a
    // generated matrix up to date before checking it, or `done --check`
    // would refuse the very test that makes the requirement deliverable.
    refreshDerivedMatrix(projectDir);

    // Before the suite: a requirement waiting for an answer is refused in a
    // second, with the reason, instead of after the slowest step (#72).
    if (opts.check && DELIVERED_STATUSES.includes(opts.status)) {
      const tracePath = path.join(projectDir, "docs", "specs", "traceability.md");
      const blocker = fs.existsSync(tracePath)
        ? deliveryBlocker(fs.readFileSync(tracePath, "utf8"), opts.reqId!)
        : null;
      if (blocker) {
        io.fail(NULL_SHAPE, [
          error(blocker.code, `not marked ${opts.status}: ${blocker.message}`, {
            target: opts.reqId!,
            fix: blocker.fix,
          }),
        ]);
      }
    }

    const harness = readHarnessConfig(projectDir) || ({} as any);
    const plan = planDoneVerification(projectDir, {
      check: opts.check,
      strict: opts.strict,
      reqId: opts.reqId || undefined,
      testCmd: opts.testCmd || harness.testCmd,
      archCmd: harness.archCmd,
    });

    if (!opts.json) process.stdout.write(ui.header(`done ${opts.reqId}`, opts.status));
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
          ? `Specification   ${ui.muted(`the gate, for ${opts.reqId}`)}`
          : step.stage === "arch"
            ? `Architecture    ${ui.muted(step.argv[0])}`
            : `Tests           ${ui.muted(step.argv[0])}`;
      const run = opts.json ? exec() : ui.task(label, exec, (r) => ({ ok: r.status === 0 }));

      if (run.status === 0) continue;

      // The output is the evidence, and it goes out *before* the diagnostic:
      // `io.fail` never returns, so anything written after it is dead code.
      const detail = `${run.stdout || ""}${run.stderr || ""}`.trim();
      if (detail && !opts.json) process.stderr.write("\n" + indent(detail) + "\n\n");

      // Over JSON (and so over MCP) the reason has to travel in the document:
      // the agent got `done_validate_failed` and nothing it could act on.
      let findings: any[] = [];
      if (opts.json && step.stage === "validate") {
        try {
          const doc = JSON.parse(String(run.stdout).slice(String(run.stdout).indexOf("{")));
          findings = (doc.status || []).filter((d: any) => d.severity === "error");
        } catch {
          // Not JSON: the diagnostic below still says it failed.
        }
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
            target: opts.reqId!,
            fix:
              step.stage === "validate"
                ? "Fix what validate reports, then run `done` again."
                : step.stage === "arch"
                  ? `Make \`${step.argv[0]}\` pass — move the code where the architecture expects it — then run \`done\` again.`
                  : `Make \`${step.argv[0]}\` pass, then run \`done\` again. A requirement ` +
                    `marked Implemented over a red suite is the claim this gate exists to stop.`,
          }
        ),
      ]);
    }

    // A generated matrix gets its status from spec.md: writing the row would
    // be undone by the next regeneration.
    const derivedRows = isDerivedProject(projectDir)
      ? writeRequirementFields(projectDir, opts.reqId!, { status: opts.status })
      : undefined;
    const result =
      derivedRows === undefined
        ? new UpdateRequirementStatusUseCase(new DiskTraceabilityRepository()).execute(
            projectDir,
            opts.reqId!,
            opts.status
          )
        : derivedRows === null
          ? {
              ok: false,
              code: "requirement_not_in_matrix",
              error: `${opts.reqId} has no section in spec.md or in a capability spec.`,
              updated: 0,
            }
          : { ok: true, updated: derivedRows };

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
        "\n" +
          ui.ok(
            `${c.bold}${opts.reqId}${c.reset} ${ui.sym.arrow} ${c.ok}${c.bold}${opts.status}${c.reset} ` +
              ui.muted(`(${updated} row${updated > 1 ? "s" : ""} updated)`)
          ) +
          (plan.testsUnverified
            ? ""
            : ui.next("specgate status", "what is left, and the next requirement"))
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
  private executeMany(opts: DoneOptions, io: ReturnType<typeof agentIo>): void {
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
    } catch (err: any) {
      io.usage(NULL_SHAPE, [
        error("project_not_found", err.message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }
    refreshDerivedMatrix(projectDir);
    const ids = [...new Set(opts.reqIds)];
    const results = new Map<
      string,
      { ok: boolean; code?: string; message?: string; detail?: string }
    >();
    const harness = readHarnessConfig(projectDir) || ({} as any);
    const testCmd = opts.testCmd || harness.testCmd;
    const gated = opts.check && DELIVERED_STATUSES.includes(opts.status);
    const tracePath = path.join(projectDir, "docs", "specs", "traceability.md");

    for (const id of ids) {
      if (gated && fs.existsSync(tracePath)) {
        const blocker = deliveryBlocker(fs.readFileSync(tracePath, "utf8"), id);
        if (blocker) {
          results.set(id, { ok: false, code: blocker.code, message: blocker.message });
          continue;
        }
      }
      const plan = planDoneVerification(projectDir, {
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
            detail: `${run.stdout || ""}${run.stderr || ""}`.trim(),
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
      const cmd = (testCmd || "").trim();
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
      const derivedRows = isDerivedProject(projectDir)
        ? writeRequirementFields(projectDir, id, { status: opts.status })
        : undefined;
      const result =
        derivedRows === undefined
          ? new UpdateRequirementStatusUseCase(new DiskTraceabilityRepository()).execute(
              projectDir,
              id,
              opts.status
            )
          : derivedRows === null
            ? {
                ok: false,
                error: `${id} has no section in spec.md or in a capability spec.`,
                updated: 0,
              }
            : { ok: true, updated: derivedRows };
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
      process.stdout.write(ui.header(`done ${ids.join(" ")}`, opts.status));
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
