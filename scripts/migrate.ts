#!/usr/bin/env node
import { MigrateCommand } from "./cli/commands/project/MigrateCommand";

export { MigrateCommand };

if (require.main === module) {
  new MigrateCommand(process.argv.slice(2)).execute();
}
