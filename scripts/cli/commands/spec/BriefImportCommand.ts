import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { importWorkshop, type WorkshopImport } from "../../../draft/workshop-import";

/**
 * `specgate brief import <file>…` (brief-from-workshop REQ-655): a DDD
 * workshop's boards, exported by DDD Toolbox, become the brief's modules and a
 * readable model per bounded context.
 */
export class BriefImportCommand extends BaseCommand {
  /** What the import did, for `propose --from-model` (REQ-657). */
  public result: WorkshopImport | null = null;

  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        "Usage:\n  specgate brief import <board.json>… [--brief <file>] [--project-dir <path>] [--json]\n\n" +
          "A DDD workshop's boards, exported by DDD Toolbox (Domain Storytelling, Event\n" +
          "Storming, Bounded Context Canvas), become the brief: one model per bounded\n" +
          "context in docs/brief/models/<context>.yaml, and each context a module of\n" +
          "docs/brief.md with its actors and a card. Every line the brief had is kept.\n" +
          "Then: specgate propose --from-brief <module>, or all at once: propose --from-model.\n"
      );
      process.exit(0);
    }
    const shape = { brief: null };
    const io = agentIo(wantsJson(argv));
    let dir = ".";
    let brief: string | undefined;
    const files: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dir = argv[++i] || ".";
      else if (a === "--brief") brief = argv[++i];
      else if (a === "--json") continue;
      else if (a.startsWith("-"))
        io.usage(shape, [
          error("unknown_flag", `Unknown flag for brief import: ${a}`, {
            fix: "specgate brief import --help",
          }),
        ]);
      else files.push(a);
    }
    if (files.length === 0)
      io.usage(shape, [
        error(
          "missing_argument",
          "brief import needs the boards: specgate brief import story.json …",
          {
            fix: "Export each board from DDD Toolbox (Save as…) and name the files.",
          }
        ),
      ]);
    let project: string;
    try {
      project = resolveProjectDir(dir);
    } catch (err) {
      io.usage(shape, [
        error("project_not_found", (err as Error).message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }
    let r: WorkshopImport;
    try {
      r = importWorkshop(project, files, brief);
    } catch (err) {
      io.fail(shape, [
        error("brief_import_unreadable", (err as Error).message, {
          fix: "Export the boards from DDD Toolbox with Save as…, then import those files.",
        }),
      ]);
      return;
    }
    this.result = r;
    io.emit({ brief: { import: r } }, () =>
      process.stdout.write(
        ui.ok(`${r.contexts.length} contexts from the workshop: ${r.contexts.join(", ")}.`) +
          "\n" +
          r.written.map((f) => `  ${f}\n`).join("") +
          (r.assumed
            ? `  ${r.assumed} flows placed in the core context by assumption: confirm them while drafting.\n`
            : "") +
          (r.added.length
            ? `  Next: specgate propose --from-brief ${r.added[0]}\n`
            : "  Every context was already a module of the brief.\n")
      )
    );
  }
}
