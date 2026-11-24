#!/usr/bin/env node
import { CompatCommand } from "./cli/commands/harness/CompatCommand";

export { CompatCommand };

if (require.main === module) {
  new CompatCommand(process.argv.slice(2)).execute();
}
