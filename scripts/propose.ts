#!/usr/bin/env node
import { CliCommand } from "./cli/commands/change/ChangeCommand";
import { DraftCommand } from "./cli/commands/spec/DraftCommand";
import { TicketCommand } from "./cli/commands/change/TicketCommand";
import { proposeUseCases } from "./cli/commands/spec/UseCasesCommand";

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
