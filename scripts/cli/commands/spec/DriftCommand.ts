import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { driftFindings, driftSince } from "../../../lib/drift";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";

const NULL_SHAPE = { drift: null };

function usage(): void {
  process.stdout.write(
    `
  🧭 ${c.bold}specgate drift${c.reset} [dir] [--base <branch>] [--json]

  Behaviour changed without a specification (REQ-333): each commit since the
  base that changes production code, names no requirement in its message, and
  changes no test that names one. \`specgate check\` reports the same.

  A report by default; \`drift: gate\` in harness.config.yaml makes it fail
  (exit 1) — for CI, where nobody reads a warning.
`
  );
}

/** `specgate drift` — the drift report on its own, for CI (REQ-333, REQ-334). */
export class DriftCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let base = "";
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--base") {
        base = argv[++i] || "";
        if (!base) {
          io.usage(NULL_SHAPE, [
            error("missing_value", "--base needs a branch.", { fix: "specgate drift --base main" }),
          ]);
        }
      } else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for drift: ${a}`, { fix: "specgate drift --help" }),
        ]);
      } else positional.push(a);
    }
    let dir: string;
    try {
      dir = resolveProjectDir(positional[0] || ".");
    } catch {
      dir = path.resolve(positional[0] || ".");
    }
    if (!fs.existsSync(dir)) {
      io.usage(NULL_SHAPE, [
        error("project_dir_not_found", `Directory not found: ${dir}`, {
          fix: "specgate drift [dir]",
        }),
      ]);
    }
    const mode = (readHarnessConfig(dir) || {}).drift || "report";
    const report = driftSince(dir, base);
    const findings = driftFindings(report, mode === "gate");
    const payload = { drift: { base: report.base, mode, commits: report.commits } };
    if (mode === "gate" && findings.length > 0) io.fail(payload, findings);
    io.emit({ ...payload, status: findings }, () => {
      process.stdout.write(ui.header("drift", path.basename(dir)));
      if (!report.base) {
        process.stdout.write(`  ${ui.muted("·  No base to compare with: nothing to report.")}\n\n`);
        return;
      }
      if (report.commits.length === 0) {
        process.stdout.write(
          `  ${c.ok}${ui.sym.ok}${c.reset}  Every change since ${report.base.slice(0, 12)} names its requirement.\n\n`
        );
        return;
      }
      for (const d of findings) process.stdout.write(ui.warn(d.message) + ui.fix(d.fix ?? ""));
      process.stdout.write("\n");
    });
  }
}
