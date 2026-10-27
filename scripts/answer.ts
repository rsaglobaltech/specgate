#!/usr/bin/env node
import { AnswerCommand } from "./cli/commands/spec/ClarifyCommands";

export { AnswerCommand };

if (require.main === module) {
  new AnswerCommand(process.argv.slice(2)).execute();
}
