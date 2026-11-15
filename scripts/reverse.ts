#!/usr/bin/env node
import { ReverseCommand } from "./cli/commands/spec/ReverseCommand";

export { ReverseCommand };

if (require.main === module) {
  new ReverseCommand(process.argv.slice(2)).execute();
}
