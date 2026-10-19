/**
 * `specgate harness run` — re-export of the command and of the decisions it makes.
 *
 * The command lives in `scripts/cli/commands/harness/RunCommand`; command
 * substitution, the gate-output hint and the dependency scheduling are domain
 * (`core/domain/HarnessRun`), which is what lets the scheduler be tested
 * without a git repository and an agent. Kept as one import site for
 * `harness report` and the run tests.
 */

import { RunCommand, error } from "../cli/commands/harness/RunCommand";

export {
  RunCommand,
  parseArgs,
  setJsonMode,
  printReport,
  runLevels,
  RUNS_DIR,
  RunRecord,
} from "../cli/commands/harness/RunCommand";

export {
  substituteAgentCommand,
  substituteGateCommand,
  filterHint,
  scheduleLevels,
  AttemptRecord,
} from "../../packages/core/src/domain/HarnessRun";

// This file is what the command registry spawns, so it stays the entry point.
if (require.main === module) {
  new RunCommand(process.argv.slice(2)).execute().catch((err: unknown) => {
    const thrown = err as { message?: string } | null | undefined;
    error(thrown && thrown.message ? thrown.message : String(err));
    process.exit(1);
  });
}
