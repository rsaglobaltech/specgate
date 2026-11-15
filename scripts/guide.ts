#!/usr/bin/env node
import { GuideCommand } from "./cli/commands/spec/GuideCommand";

export { GuideCommand };

if (require.main === module) {
  new GuideCommand(process.argv.slice(2)).execute();
}
