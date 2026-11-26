#!/usr/bin/env node
import { ReproduceCommand } from "./cli/commands/spec/ReproduceCommand";

export { ReproduceCommand };

if (require.main === module) {
  new ReproduceCommand(process.argv.slice(2)).execute();
}
