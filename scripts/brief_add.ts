#!/usr/bin/env node
import { BriefAddCommand } from "./cli/commands/spec/ClarifyCommands";

export { BriefAddCommand };

if (require.main === module) {
  new BriefAddCommand(process.argv.slice(2)).execute();
}
