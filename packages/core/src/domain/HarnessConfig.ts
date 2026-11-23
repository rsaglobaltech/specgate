import type { QualityConfig } from "./QualityChecks";
import type { SandboxConfig } from "./Sandbox";

/** What a time limit applies to (REQ-584). */
export type TimeoutKind = "agent" | "setup" | "tests" | "review";
export const TIMEOUT_KINDS: TimeoutKind[] = ["agent", "setup", "tests", "review"];

export interface HarnessSettings {
  agent: string;
  /**
   * The profile `agent` was resolved from — `--profile` or `agent_profile:` —
   * so the run records whose tokens and hint they were (REQ-509). Empty for a
   * command given as is.
   */
  agentProfile?: string;
  /** The quality and security checks, by stage (ADR-0040). Absent: none configured. */
  quality?: QualityConfig;
  testCmd: string;
  /**
   * What `check --affected` and `apply` run instead of `test_cmd`, with
   * `{files}` or `{req}` (REQ-513): `test_cmd` stays the whole suite.
   */
  testCmdAffected?: string;
  /** Globs of files whose change makes `check --affected` run everything (REQ-511). */
  fullOn?: string[];
  /** False: `check` runs the architecture check and the tests one after the other (REQ-518). */
  gateParallel?: boolean;
  /**
   * The team's architecture check (ArchUnit, dependency-cruiser, import-linter…),
   * run between validation and the tests wherever the gate runs (ADR-0028).
   * Empty: the architecture is not checked, and `check` says so.
   */
  archCmd?: string;
  /**
   * The command that runs the feature files (REQ-661): playwright-bdd, Cucumber…,
   * `{tags}` standing for the scenarios to run — `@REQ-031` for one requirement.
   */
  bddCmd?: string;
  /** agent-routing REQ-689: the profile whose agent drafts, apart from the build agent. */
  draftProfile?: string;
  /**
   * The SARIF `arch_cmd` writes, when it writes one (REQ-231): its findings
   * are judged against the baseline, so only a violation a change adds fails.
   */
  archSarif?: string;
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
   * REQ-532: `tester` then `implementer` as separate sessions of each attempt,
   * each kept to its lane (REQ-533). Empty means one session per attempt.
   */
  lanes?: Array<"tester" | "implementer">;
  /** REQ-535: what one requirement's sessions may cost, in USD. 0 means no limit. */
  maxCostUsd?: number;
  /** REQ-585: what the whole run may cost, in USD; no requirement starts once it is spent. 0: no limit. */
  maxRunCostUsd?: number;
  /** REQ-585: the tokens one requirement's sessions may use. 0: no limit. */
  maxTokens?: number;
  /** REQ-585: a session that reports no cost or tokens fails its requirement, instead of counting as free. */
  requireKnownCost?: boolean;
  /** REQ-584: seconds per kind of command; each falls back to `--timeout`. */
  timeouts?: Partial<Record<TimeoutKind, number>>;
  /**
   * REQ-587: the environment variables the agent gets, besides the few every
   * process needs (PATH, HOME, …) and the harness's own. Absent: all of them.
   */
  agentEnv?: string[];
  /** REQ-588: run the agent in a container (\`sandbox:\`). Absent: on the machine, as before. */
  sandbox?: SandboxConfig;
  /** REQ-589: one download cache for every worktree, under \`.harness/cache/\`. */
  dependencyCache?: boolean;
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
   * Where the project's end-to-end tests live (REQ-199). Set it and a
   * requirement whose actor uses a screen (web, mobile, tablet, desktop) passes
   * the gate only when a file there names it: a use case and a unit test
   * passed twenty screen requirements that had no screen.
   */
  e2eDir?: string;
  /** Where the running app is reached, e.g. http://localhost:5173: the map's addresses start here (REQ-678). */
  appUrl?: string;
  /**
   * Behaviour changed without a specification (REQ-333, REQ-334): `report`
   * (the default) warns, `gate` fails `check`, `off` does not look.
   */
  drift?: "report" | "gate" | "off";
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
      archCmd: cliArgs.archCmd || file.archCmd || "",
      bddCmd: file.bddCmd || "",
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
