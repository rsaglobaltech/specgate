#!/usr/bin/env node
import { MatrixCommand, refreshDerivedMatrix } from "./cli/commands/spec/MatrixCommand";

export { MatrixCommand, refreshDerivedMatrix };

if (require.main === module) {
  new MatrixCommand(process.argv.slice(2)).execute();
}
