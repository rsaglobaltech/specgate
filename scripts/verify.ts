#!/usr/bin/env node
import { VerifyCommand, parseArgs } from "./cli/commands/quality/VerifyCommand";

export { VerifyCommand, parseArgs };

if (require.main === module) {
  new VerifyCommand(process.argv.slice(2)).execute();
}
