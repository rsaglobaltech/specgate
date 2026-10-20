#!/usr/bin/env node
import { CliCommand } from "./cli/commands/change/ChangeCommand";
import { DraftCommand } from "./cli/commands/spec/DraftCommand";

/**
 * `specgate propose` — the first of the daily verbs (ADR-0035). An idea opens
 * a change, as `change new` does; `--from-brief` drafts the next module of
 * docs/brief.md, as `draft` does. One engine each, two ways in.
 */
export function propose(argv: string[]): void {
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
