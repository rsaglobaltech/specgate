#!/usr/bin/env node
import { CiStatusCommand } from "./cli/commands/config/CiStatusCommand";

export { CiStatusCommand };

if (require.main === module) {
  new CiStatusCommand(process.argv.slice(2)).execute();
}
