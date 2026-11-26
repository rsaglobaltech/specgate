#!/usr/bin/env node
import { TrustCommand } from "./cli/commands/project/TrustCommand";

export { TrustCommand };

if (require.main === module) {
  new TrustCommand(process.argv.slice(2)).execute();
}
