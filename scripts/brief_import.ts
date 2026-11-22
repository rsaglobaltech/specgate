#!/usr/bin/env node
import { BriefImportCommand } from "./cli/commands/spec/BriefImportCommand";

export { BriefImportCommand };

if (require.main === module) {
  new BriefImportCommand(process.argv.slice(2)).execute();
}
