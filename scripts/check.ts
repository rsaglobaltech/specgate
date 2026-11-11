#!/usr/bin/env node
import { CheckCommand } from "./cli/commands/quality/CheckCommand";

export { CheckCommand };

if (require.main === module) {
  void new CheckCommand(process.argv.slice(2)).execute();
}
