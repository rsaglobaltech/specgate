#!/usr/bin/env node
import { AskCommand } from "./cli/commands/spec/ClarifyCommands";

export { AskCommand };

if (require.main === module) {
  new AskCommand(process.argv.slice(2)).execute();
}
