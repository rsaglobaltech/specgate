#!/usr/bin/env node
import { DraftCommand, parseArgs } from "./cli/commands/spec/DraftCommand";

export { DraftCommand, parseArgs };

if (require.main === module) {
  new DraftCommand(process.argv.slice(2)).execute();
}
