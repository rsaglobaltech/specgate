#!/usr/bin/env node
import { NewCommand } from "./cli/commands/spec/NewCommand";

export { NewCommand };

if (require.main === module) {
  new NewCommand(process.argv.slice(2)).execute();
}
