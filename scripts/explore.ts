#!/usr/bin/env node
import { ExploreCommand } from "./cli/commands/spec/ExploreCommand";

export { ExploreCommand };

if (require.main === module) {
  new ExploreCommand(process.argv.slice(2)).execute();
}
