import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { contractReport } from "../../../lib/contracts";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";

const NULL_SHAPE = { contract: null };

function usage(): void {
  process.stdout.write(
    `
  📜 ${c.bold}specgate contract check${c.reset} [dir] [--json]

  Each OpenAPI or AsyncAPI contract of the project against the requirements
  that cite it with \`api=\` in their specgate:trace comment (REQ-336):
    - an operation no requirement cites      a warning
    - a requirement citing a missing one     an error (exit 1)
    - a delivered requirement whose code     a warning (REQ-408)
      neither serves nor calls the path
`
  );
}

/** `specgate contract check` — contracts against the requirements (REQ-336). */
export class ContractCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const io = agentIo(wantsJson(argv));
    const [sub, ...rest] = argv.filter((a) => a !== "--json");
    if (sub !== "check") {
      io.usage(NULL_SHAPE, [
        error("unknown_subcommand", `Unknown contract sub-command: ${sub}`, {
          fix: "specgate contract check",
        }),
      ]);
    }
    const flag = rest.find((a) => a.startsWith("-"));
    if (flag) {
      io.usage(NULL_SHAPE, [
        error("unknown_flag", `Unknown flag for contract check: ${flag}`, {
          fix: "specgate contract --help",
        }),
      ]);
    }
    let dir: string;
    try {
      dir = resolveProjectDir(rest[0] || ".");
    } catch {
      dir = path.resolve(rest[0] || ".");
    }
    if (!fs.existsSync(dir)) {
      io.usage(NULL_SHAPE, [
        error("project_dir_not_found", `Directory not found: ${dir}`, {
          fix: "specgate contract check [dir]",
        }),
      ]);
    }
    const { report, status } = contractReport(dir);
    if (status.some((d) => d.severity === "error")) io.fail({ contract: report }, status);
    io.emit({ contract: report, status }, () => {
      process.stdout.write(ui.header("contract check", path.basename(dir)));
      if (report.contracts.length === 0) {
        process.stdout.write(
          `  ${ui.muted("·  No OpenAPI or AsyncAPI contract in this project.")}\n\n`
        );
        return;
      }
      for (const k of report.contracts) {
        process.stdout.write(
          `  ${c.bold}${k.file}${c.reset}  ${ui.muted(`${k.kind} · ${k.cited.length} of ${k.operations} operations cited`)}\n`
        );
        for (const line of k.cited)
          process.stdout.write(`    ${c.ok}${ui.sym.ok}${c.reset}  ${line}\n`);
        for (const line of k.uncited)
          process.stdout.write(
            `    ${c.warn}${ui.sym.warn}${c.reset}  ${line}  ${ui.muted("no requirement")}\n`
          );
      }
      process.stdout.write("\n");
    });
  }
}
