#!/usr/bin/env node
import { DoneCommand } from "./cli/commands/spec/DoneCommand";

/** `specgate apply` — deliver one requirement through the gate (ADR-0035). `done` is its old name. */
if (require.main === module) {
  new DoneCommand(process.argv.slice(2), "apply").execute();
}
