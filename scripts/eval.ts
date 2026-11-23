#!/usr/bin/env node
import { EvalCommand } from "./cli/commands/harness/EvalCommand";

export { EvalCommand };

if (require.main === module) {
  new EvalCommand(process.argv.slice(2)).execute();
}
