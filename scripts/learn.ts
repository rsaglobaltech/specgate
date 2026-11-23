#!/usr/bin/env node
import { LearnCommand } from "./cli/commands/project/LearnCommand";

export { LearnCommand };

if (require.main === module) {
  new LearnCommand(process.argv.slice(2)).execute();
}
