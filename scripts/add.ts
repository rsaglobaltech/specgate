#!/usr/bin/env node
import { AddCommand } from "./cli/commands/project/AddCommand";

export { AddCommand };

if (require.main === module) {
  new AddCommand(process.argv.slice(2)).execute();
}
