#!/usr/bin/env node
import { ReleaseNotesCommand } from "./cli/commands/spec/ReleaseNotesCommand";

export { ReleaseNotesCommand };

if (require.main === module) {
  new ReleaseNotesCommand(process.argv.slice(2)).execute();
}
