#!/usr/bin/env node
import { ScenariosCommand } from "./cli/commands/spec/ScenariosCommand";

export { ScenariosCommand };

if (require.main === module) {
  new ScenariosCommand(process.argv.slice(2)).execute();
}
