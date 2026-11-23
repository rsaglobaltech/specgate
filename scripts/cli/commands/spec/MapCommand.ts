import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { featureMap } from "../../../lib/feature-map";

const NULL_SHAPE = { map: null };

function usage(): void {
  process.stdout.write(
    `
  🗺️  ${c.bold}specgate map${c.reset} [<REQ>] [--capability <c>] [--json] [--project-dir <dir>]

  Where each requirement lives: its use case, who uses it, the route and the
  address where it is reached in the app, its feature, code and tests (REQ-678).
  The route is the trace's route=, else the first page an end-to-end test that
  names the requirement opens; the address starts at app_url
  (specgate config set app_url http://localhost:5173).
`
  );
}

export class MapCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let capability: string | null = null;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--capability") capability = argv[++i] || null;
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for map: ${a}`, { fix: "specgate map --help" }),
        ]);
    }
    const dir = path.resolve(dirArg);
    const only = positional.find((p) => /^REQ-/.test(p)) || null;
    let requirements = featureMap(dir);
    if (capability) requirements = requirements.filter((r) => r.capability === capability);
    if (only) {
      requirements = requirements.filter((r) => r.requirement === only);
      if (!requirements.length)
        io.fail(NULL_SHAPE, [
          error("requirement_not_found", `${only} is not a requirement of this project.`, {
            target: only,
            fix: "specgate map — every requirement",
          }),
        ]);
    }
    io.emit({ map: { projectDir: dir, requirements } }, () => {
      const out = (s: string) => process.stdout.write(s);
      out(ui.header("map", `${requirements.length} requirement(s)`));
      for (const r of requirements) {
        const where = r.url || r.route || ui.muted("no route");
        out(
          `  ${c.bold}${r.requirement}${c.reset}  ${r.title}\n` +
            `     ${where}` +
            ui.muted(
              `  · ${r.useCase || "no use case"} · ${r.tests.length} test(s)${r.e2e.length ? `, ${r.e2e.length} e2e` : ""} · ${r.code.length} code file(s) · ${r.status}`
            ) +
            "\n"
        );
      }
      out("\n");
    });
  }
}
