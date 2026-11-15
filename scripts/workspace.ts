#!/usr/bin/env node
import { WorkspaceCommand } from "./cli/commands/workspace/WorkspaceCommand";

export { WorkspaceCommand };

if (require.main === module) {
  new WorkspaceCommand(process.argv.slice(2)).execute();
}
