#!/usr/bin/env node
import { MapCommand } from "./cli/commands/spec/MapCommand";

export { MapCommand };

if (require.main === module) {
  new MapCommand(process.argv.slice(2)).execute();
}
