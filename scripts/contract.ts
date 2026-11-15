#!/usr/bin/env node
import { ContractCommand } from "./cli/commands/spec/ContractCommand";

export { ContractCommand };

if (require.main === module) {
  new ContractCommand(process.argv.slice(2)).execute();
}
