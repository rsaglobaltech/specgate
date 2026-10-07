export interface HarnessSettings {
  agent: string;
  testCmd: string;
  /**
   * Run once in each fresh worktree before the agent — `npm ci`, say. The
   * worktree carries only what git tracks, so without it the agent could not
   * run the tests it is asked to write, and a gate of `npm ci && …` made every
   * local `check` reinstall dependencies too.
   */
  setupCmd?: string;
  maxAttempts: number;
  concurrency: number;
  promptPrefix: string;
  push: boolean;
  remote: string;
  prCmd: string;
  /** Profile per attempt; the last rung repeats. Empty means one agent throughout. */
  attemptProfiles: string[];
  /** Advisory profile run before each retry, or "" for none. */
  reviewProfile: string;
  /**
   * Profile that tries to break a green implementation (D3), or "" for none.
   *
   * Runs once per requirement, after the gate has passed, and its writes are
   * discarded. A failing probe is a recorded finding, never a verdict — the
   * gate stays the only judge.
   */
  adversaryProfile: string;
  /**
   * Show the agent an accepted requirement from the same bounded context (D2).
   *
   * Off by default: it costs prompt budget, and on a project with nothing
   * `Verified` yet there is nothing to show — the section simply does not
   * appear rather than appearing empty.
   */
  promptPrecedents: boolean;
  /** Profile name to the shell command it resolves to. */
  profileAgents: Record<string, string>;
  /**
   * Paths the agent may not modify (A1). Empty means the built-in defaults —
   * naming your own list replaces them, which is the point of naming it.
   */
  protectedPaths: string[];
  /** Explicit exceptions to the above. Never silent: it has to be written down. */
  allowPaths: string[];
  /**
   * Where the test command writes a Cucumber `--format message` NDJSON stream
   * (F5). Set it and the gate reads what the runner did instead of trusting its
   * exit code. Empty means the harness will offer to add the flag itself, but
   * only to a direct `cucumber-js` invocation.
   */
  messageReport: string;
  /**
   * Per-profile `cost_per_run_hint` from `.harness/profiles.yaml` (C1). A
   * declared estimate, never a measurement: an agent is any shell command and
   * only the agent knows what it spent.
   */
  costPerRunHint: Record<string, number>;
  /**
   * Profiles that select themselves by matching a requirement (D1), in file
   * order — first match wins. Empty means every requirement gets the run's
   * single profile, as before.
   */
  profileRules: Array<{ name: string; match: Record<string, string> }>;
}

export class HarnessConfig {
  public static readonly FILENAME = "harness.config.yaml";
  public static readonly DEFAULT_SETTINGS: HarnessSettings = {
    agent: "",
    testCmd: "",
    maxAttempts: 3,
    concurrency: 1,
    promptPrefix: "",
    push: false,
    remote: "origin",
    prCmd: "",
    attemptProfiles: [],
    reviewProfile: "",
    adversaryProfile: "",
    promptPrecedents: false,
    profileAgents: {},
    protectedPaths: [],
    allowPaths: [],
    messageReport: "",
    costPerRunHint: {},
    profileRules: [],
  };

  public constructor(public readonly settings: HarnessSettings) {}

  public static merge(
    fileConfig: Partial<HarnessSettings> | null,
    cliArgs: Partial<HarnessSettings>
  ): HarnessConfig {
    const file = fileConfig || {};
    return new HarnessConfig({
      agent: cliArgs.agent || file.agent || HarnessConfig.DEFAULT_SETTINGS.agent,
      testCmd: cliArgs.testCmd || file.testCmd || HarnessConfig.DEFAULT_SETTINGS.testCmd,
      setupCmd: file.setupCmd || "",
      maxAttempts:
        cliArgs.maxAttempts || file.maxAttempts || HarnessConfig.DEFAULT_SETTINGS.maxAttempts,
      concurrency:
        cliArgs.concurrency || file.concurrency || HarnessConfig.DEFAULT_SETTINGS.concurrency,
      promptPrefix:
        cliArgs.promptPrefix || file.promptPrefix || HarnessConfig.DEFAULT_SETTINGS.promptPrefix,
      push:
        cliArgs.push !== undefined
          ? cliArgs.push
          : file.push !== undefined
            ? file.push
            : HarnessConfig.DEFAULT_SETTINGS.push,
      remote: cliArgs.remote || file.remote || HarnessConfig.DEFAULT_SETTINGS.remote,
      prCmd: cliArgs.prCmd || file.prCmd || HarnessConfig.DEFAULT_SETTINGS.prCmd,
      attemptProfiles: file.attemptProfiles || HarnessConfig.DEFAULT_SETTINGS.attemptProfiles,
      reviewProfile: file.reviewProfile || HarnessConfig.DEFAULT_SETTINGS.reviewProfile,
      adversaryProfile: "",
      promptPrecedents:
        file.promptPrecedents === undefined
          ? HarnessConfig.DEFAULT_SETTINGS.promptPrecedents
          : file.promptPrecedents === true,
      profileAgents: file.profileAgents || HarnessConfig.DEFAULT_SETTINGS.profileAgents,
      // Write scope is a repository decision, like the role ladder: it comes
      // from the file only. A flag that relaxes what the agent may edit is a
      // flag somebody eventually types to make a red run go green.
      protectedPaths: file.protectedPaths || HarnessConfig.DEFAULT_SETTINGS.protectedPaths,
      allowPaths: file.allowPaths || HarnessConfig.DEFAULT_SETTINGS.allowPaths,
      messageReport: file.messageReport || HarnessConfig.DEFAULT_SETTINGS.messageReport,
      costPerRunHint: file.costPerRunHint || HarnessConfig.DEFAULT_SETTINGS.costPerRunHint,
      profileRules: file.profileRules || HarnessConfig.DEFAULT_SETTINGS.profileRules,
    });
  }
}
