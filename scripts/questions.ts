#!/usr/bin/env node
import { QuestionsCommand } from "./cli/commands/spec/ClarifyCommands";

export { QuestionsCommand };

if (require.main === module) {
  new QuestionsCommand(process.argv.slice(2)).execute();
}
