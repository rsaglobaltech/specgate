#!/usr/bin/env node
import { AdrCommand } from "./cli/commands/spec/AdrCommand";

export { AdrCommand };

if (require.main === module) {
  new AdrCommand(process.argv.slice(2)).execute();
}
