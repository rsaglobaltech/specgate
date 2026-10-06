/**
 * What `done --check` has to prove before it flips a row (Fase 1.1).
 *
 * ## What it was
 *
 * `--check` and `--strict` were parsed into `DoneOptions` and then never read.
 * `done REQ-001 --check` was a no-op that printed a tick — measured on a matrix
 * pointing at files that do not exist, where `validate --strict-links` exits 1:
 *
 *     ✔  REQ-001 → Implemented (1 row updated)     exit=0
 *
 * Four documentation pages say `--check` "validates first". It validated
 * nothing. That is the shape this repository keeps finding in itself: something
 * that claims more than it does.
 *
 * ## Why the test command matters here specifically
 *
 * A cold evaluator's summary of the product was "nothing ever runs a test", and
 * they were right: only the harness executes a test command, so a team on the
 * documented path never runs one. `validate` is a static checker — it reads
 * markdown and stats files. Marking a requirement Implemented on the strength
 * of a static check is how "specs as executable contracts" becomes a folder of
 * markdown and a badge.
 *
 * ## The rule about not knowing
 *
 * A project with no test command configured is not a project that passed. It is
 * a project nothing ran, and the two have to look different — otherwise the
 * silent case is the flattering one, which is the bias this whole tool exists to
 * remove.
 */

export type VerificationStage = "validate" | "tests";

export interface VerificationStep {
  stage: VerificationStage;
  /** The command line, for the diagnostic and for `--dry-run`-ish reporting. */
  argv: string[];
}

export interface DoneVerificationPlan {
  steps: VerificationStep[];
  /**
   * True when nothing will execute the project's own tests.
   *
   * The caller must say so out loud rather than reporting a pass: `done` is the
   * command that writes `Implemented` into the record other people read.
   */
  testsUnverified: boolean;
}

export interface DoneCheckOptions {
  check: boolean;
  strict: boolean;
  /**
   * The requirement being closed. Its row still says Draft while the checks
   * run, and a Draft row owes no files — so without this, `done --check`
   * would skip the one requirement it is about to mark Implemented.
   */
  reqId?: string;
  /** From `--test-cmd`, or `test_cmd:` in harness.config.yaml. */
  testCmd?: string;
}

/**
 * The checks `done` should run, in the order they should run.
 *
 * `validate` comes first because it is fast and its failures are the ones with
 * a fix line attached; running a whole test suite to then reject the row for a
 * missing matrix header wastes the slowest thing in the loop.
 */
export function planDoneVerification(
  projectDir: string,
  opts: DoneCheckOptions
): DoneVerificationPlan {
  if (!opts.check && !opts.strict) return { steps: [], testsUnverified: false };

  const validateArgs = [projectDir];
  if (opts.strict) {
    // `--strict` means "the gate this project can actually give me". Anything
    // weaker recreates the defect a cold evaluator named: following the
    // documentation leaves you with a weaker gate than the tool supports.
    validateArgs.push("--strict-tdd", "--strict-links", "--strict-coverage");
  }
  if (opts.reqId) validateArgs.push("--delivering", opts.reqId);

  const steps: VerificationStep[] = [{ stage: "validate", argv: validateArgs }];

  const testCmd = (opts.testCmd || "").trim();
  if (testCmd !== "") steps.push({ stage: "tests", argv: [testCmd] });

  return { steps, testsUnverified: testCmd === "" };
}

/** The line `done` prints when nothing ran the project's tests. */
export const NO_TEST_COMMAND_WARNING = Object.freeze({
  message: "No test command configured — this checked the specification, not the code.",
  fix: [
    'Pass --test-cmd "<command>", or set test_cmd: in harness.config.yaml so',
    "every `done --check` runs it. A requirement marked Implemented on a static",
    "check alone is a claim nothing executed.",
  ],
});
