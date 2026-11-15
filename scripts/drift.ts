#!/usr/bin/env node
import { DriftCommand } from "./cli/commands/spec/DriftCommand";

export { DriftCommand };

if (require.main === module) {
  new DriftCommand(process.argv.slice(2)).execute();
}
