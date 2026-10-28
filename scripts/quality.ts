#!/usr/bin/env node
import { QualityCommand } from "./cli/commands/quality/QualityCommand";

export { QualityCommand };

if (require.main === module) {
  new QualityCommand(process.argv.slice(2)).execute();
}
