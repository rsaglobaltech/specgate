#!/usr/bin/env node
import { EvidenceCommand } from "./cli/commands/spec/EvidenceCommand";

export { EvidenceCommand };

if (require.main === module) {
  new EvidenceCommand(process.argv.slice(2)).execute();
}
