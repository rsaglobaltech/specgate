#!/usr/bin/env node
import { AcceptanceCommand } from "./cli/commands/spec/AcceptanceCommand";

export { AcceptanceCommand };

if (require.main === module) {
  new AcceptanceCommand(process.argv.slice(2)).execute();
}
