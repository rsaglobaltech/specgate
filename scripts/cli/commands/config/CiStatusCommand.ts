import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { ciStatus } from "./CiStatus";

/** `specgate ci status`: what the project's CI checks, and what it lacks (REQ-460). */
export class CiStatusCommand extends BaseCommand {
  public execute(): void {
    let args = this.args;
    if (args[0] === "ci") args = args.slice(1);
    if (args[0] === "status") args = args.slice(1);
    let projectDir = process.cwd();
    let json = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--project-dir" && args[i + 1]) projectDir = path.resolve(args[++i]);
      else if (a === "--json") json = true;
      else if (a === "--help" || a === "-h") {
        process.stdout.write(
          "Usage:\n  specgate ci status [--project-dir <dir>] [--json]\n\n" +
            "What the project's CI checks, each validation specgate knows present or missing,\n" +
            "and how to add what is missing.\n"
        );
        process.exit(0);
      } else {
        process.stderr.write(ui.fail(`Unknown argument: ${a}`));
        process.exit(2);
      }
    }
    const status = ciStatus(projectDir);
    if (json) {
      process.stdout.write(JSON.stringify(status, null, 2) + "\n");
      process.exit(0);
    }
    const out = process.stdout;
    out.write(ui.header("ci status", status.file ?? "no CI file"));
    if (!status.file) {
      out.write(ui.warn("No CI file runs specgate here."));
      out.write(ui.next("specgate ci init", "install the spec gate"));
      process.exit(0);
    }
    for (const c of status.checks) {
      out.write(c.present ? ui.ok(c.label) : ui.warn(`${c.label} — missing`));
    }
    const missing = status.checks.filter((c) => !c.present);
    out.write(
      missing.length
        ? ui.next(missing[0].add ?? "specgate ci init", `add the ${missing.length} missing`)
        : "\n" + ui.ok("Everything specgate can check runs in CI.")
    );
    process.exit(0);
  }
}
