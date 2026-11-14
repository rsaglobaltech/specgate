#!/usr/bin/env node
import { StackCommand } from "./cli/commands/spec/StackCommand";

export { StackCommand };

if (require.main === module) {
  new StackCommand(process.argv.slice(2)).execute();
}
