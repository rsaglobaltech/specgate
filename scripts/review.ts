#!/usr/bin/env node
import { ReviewCommand } from "./cli/commands/spec/ReviewCommand";

export { ReviewCommand };

if (require.main === module) {
  new ReviewCommand(process.argv.slice(2)).execute();
}
