#!/usr/bin/env node
import { PetCommand } from "./cli/commands/spec/PetCommand";

export { PetCommand };

if (require.main === module) {
  new PetCommand(process.argv.slice(2)).execute();
}
