#!/usr/bin/env node
import { CheckCommand } from "./cli/commands/quality/CheckCommand";

export { CheckCommand };

if (require.main === module) {
  new CheckCommand(process.argv.slice(2)).execute();
}
