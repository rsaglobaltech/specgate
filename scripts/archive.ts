#!/usr/bin/env node
import { CliCommand } from "./cli/commands/change/ChangeCommand";

/** `specgate archive` — close a change once every requirement in it is delivered (ADR-0035). */
if (require.main === module) {
  new CliCommand(["archive", ...process.argv.slice(2)], "archive").execute();
}
