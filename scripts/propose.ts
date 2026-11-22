#!/usr/bin/env node
import { CliCommand } from "./cli/commands/change/ChangeCommand";
import { DraftCommand } from "./cli/commands/spec/DraftCommand";
import { TicketCommand } from "./cli/commands/change/TicketCommand";
import { proposeUseCases } from "./cli/commands/spec/UseCasesCommand";
import { BriefImportCommand } from "./cli/commands/spec/BriefImportCommand";
import { importWorkshop } from "./draft/workshop-import";
import { resolveProjectDir } from "./lib/project-root";

/**
 * `specgate propose` — the first of the daily verbs (ADR-0035). An idea opens
 * a change, as `change new` does; `--from-brief` drafts the next module of
 * docs/brief.md, as `draft` does; `--from-ticket` takes a Jira ticket as the
 * source text instead (ADR-0039).
 */
export function propose(argv: string[]): void {
  // REQ-636: the use cases of requirements delivered before the catalog was kept.
  if (argv.includes("--use-cases")) {
    proposeUseCases(argv.filter((a) => a !== "--use-cases"));
    return;
  }
  if (argv.includes("--from-ticket")) {
    void new TicketCommand(argv).execute();
    return;
  }
  // REQ-657: a DDD workshop's boards imported, then their first module drafted.
  if (argv.includes("--from-model")) {
    const rest = argv.filter((a) => a !== "--from-model");
    const files = rest.filter((a) => /\.json$/i.test(a));
    const flags = rest.filter((a) => !files.includes(a));
    const json = flags.includes("--json");
    let added: string[];
    if (json) {
      // One answer on stdout: the draft's; the import is quiet.
      const at = flags.indexOf("--project-dir");
      added = importWorkshop(resolveProjectDir(at >= 0 ? flags[at + 1] || "." : "."), files).added;
    } else {
      const imported = new BriefImportCommand([...files, ...flags]);
      imported.execute();
      added = imported.result?.added ?? [];
      if (added.length > 1)
        process.stdout.write(
          `  Then: ${added
            .slice(1)
            .map((m) => `specgate propose --from-brief ${m}`)
            .join(" · ")}\n`
        );
    }
    if (!added[0]) return;
    new DraftCommand([added[0], ...flags], "propose --from-brief").execute();
    return;
  }
  if (argv.includes("--from-brief")) {
    new DraftCommand(
      argv.filter((a) => a !== "--from-brief"),
      "propose --from-brief"
    ).execute();
    return;
  }
  new CliCommand(["new", ...argv], "propose").execute();
}

if (require.main === module) propose(process.argv.slice(2));
