/**
 * The decisions `specgate harness run` makes before it spawns anything.
 *
 * Substituting a command template, reading a hint out of a gate's output, and
 * working out which requirements can run at the same time are all judgements
 * over data. Spawning the agent, running the gate, cutting branches and
 * writing the ledger are not, and stay in the command.
 *
 * Keeping them apart is what makes the scheduler testable: a dependency cycle
 * or a mis-substituted `{feature_file}` is a bug you want to find without a
 * git repository and an agent.
 */

import { RequirementGraph } from "./RequirementGraph";

/**
 * Substitute the {prompt_file} placeholder in an agent command template.
 * Throws when the template is missing the placeholder — without it the agent
 * would never receive the prompt.
 */
export function substituteAgentCommand(template, promptFile) {
  if (!template.includes("{prompt_file}")) {
    throw new Error(
      "The agent command must contain the {prompt_file} placeholder, e.g. " +
        '--agent "claude -p < {prompt_file}"'
    );
  }
  return template.split("{prompt_file}").join(promptFile);
}

/** Run the gate (validate --strict-tdd, then the optional test command). */
/**
 * Fill the placeholders a gate command may use.
 *
 * Without this, `test_cmd` was a fixed string, so a project could not run the
 * scenario belonging to the requirement under test — and the gate runs *before*
 * `done`, so the requirement is still Draft and `validate --strict-tdd` does not
 * demand its test either. The loop could therefore mark a requirement
 * Implemented without ever executing its scenario, which is the one thing this
 * whole tool exists to prevent.
 *
 * `{feature_file}` is the useful one in practice: most runners accept a path and
 * will run exactly that feature's scenarios.
 */
/**
 * The feature file a requirement points at, as a plain relative path.
 *
 * The matrix stores it as markdown, so `plan --format json` hands it over
 * still wearing its back-ticks — `` `features/core/health.feature` `` — and it
 * may carry a `#SCN-001` fragment. Three callers needed the bare path and two
 * of them had grown their own copy of this normalisation; a third would have
 * been the H14 shape again, several readers disagreeing about the same text.
 * Worse, the failure is silent: an un-stripped path simply does not exist, so a
 * check that reads it finds nothing wrong and says so.
 *
 * Returns `""` when the requirement declares no feature.
 */
export function featureFilePath(req): string {
  return String(req.featureFile || req.feature_file || "")
    .replace(/^`|`$/g, "")
    .split("#")[0]
    .trim();
}

export function substituteGateCommand(template, req) {
  const featureFile = featureFilePath(req);
  return template
    .split("{req}")
    .join(req.requirement || "")
    .split("{scenario}")
    .join(req.scenarioId || req.scenario_id || "")
    .split("{feature_file}")
    .join(featureFile);
}

/** What one attempt cost, and the step it stopped at. */
export interface AttemptRecord {
  attempt: number;
  /**
   * `write-scope` is its own stage rather than a flavour of `gate`: it means the
   * agent edited the contract it was being judged against, which `harness
   * report` should be able to count separately from a run that simply failed.
   */
  endedAt:
    | "pass"
    | "agent-timeout"
    | "agent-error"
    | "write-scope"
    /**
     * The agent wrote no files at all, so there was nothing to gate (H19).
     * Its own stage because the fix is never in the code — it is the agent's
     * write permissions or its prompt, and `harness report` should not file it
     * under a failing gate.
     */
    | "no-op"
    /**
     * The agent could not run at all — out of quota or rate-limited — so
     * retrying could not help (#50).
     */
    | "agent-unavailable"
    /**
     * The gate failed only on files the agent may not edit, so the fix belongs
     * to a person changing the specification, not to another attempt (#50).
     */
    | "spec"
    | "gate"
    /** Green gate, but the diff missed the declared artifacts (A2, --strict-artifacts). */
    | "artifacts"
    | "done"
    | "commit";
  /** Wall-clock inside the agent command alone. */
  agentMs: number;
  /** Wall-clock for the whole attempt: prompt, agent, gate, done, commit. */
  totalMs: number;
  /**
   * Which roles ran this attempt, in order.
   *
   * The profile *name*, never the command: an agent command is exactly the kind
   * of string that ends up carrying an API key, and the run record is a file in
   * the project.
   */
  profiles?: string[];
}

/**
 * Warn when a gate that asked to be filtered plainly was not.
 *
 * REQ-002 cost two agent runs to explain: the requirement's scenario passed, the
 * gate ran the whole suite anyway — a `paths` key in the base branch's cucumber
 * config silently overrode the CLI argument — and the failure was
 * indistinguishable from the agent having written broken code.
 *
 * The harness cannot know how many tests *should* run. What it can notice is a
 * command that substituted one feature file against output that talks about
 * many, which is the shape of that mistake. A hint, not a verdict: a legitimate
 * failure must not be second-guessed into passing.
 */
export function filterHint(template, req, output) {
  if (!String(template).includes("{feature_file}")) return "";
  const featureFile = substituteGateCommand("{feature_file}", req);
  if (!featureFile) return "";

  // "16 scenarios", "42 tests", "7 examples" — the common shapes.
  // `\b` before the digits: without it the engine restarts inside a long run of
  // them, which is the polynomial case CodeQL reports. One separator, because
  // `[ \t]+` before a word is another way to say the same scan twice.
  const counted = /\b(\d+)[ \t](scenarios|tests|examples|specs)\b/i.exec(output);
  if (!counted || Number(counted[1]) <= 1) return "";

  return (
    `The gate asked for one feature (${featureFile}) and the run reported ` +
    `${counted[1]} ${counted[2].toLowerCase()}. The filter may not be applying — ` +
    "a runner config that pins its own paths can override the argument. Check " +
    "that config on the base branch, not only on main."
  );
}

/**
 * Split the pending queue into levels, and say what each requirement waits for.
 *
 * `plan` already ordered the queue and told us what every requirement builds
 * on (E1-01). What the harness needs on top of that is the *grouping*: a level
 * is a set of requirements that do not depend on one another, so they are the
 * ones that could run at the same time.
 *
 * Dependencies on requirements that are already DONE do not appear here —
 * `plan` reports them under `dependsOn` but not `blockedBy`, because a
 * finished dependency constrains nothing.
 */
export function scheduleLevels(pending) {
  const pendingIds = pending.map((r) => r.requirement);
  const inQueue = new Set(pendingIds);

  const dependsOn = {};
  for (const req of pending) {
    // Only dependencies that are themselves in this run constrain the order.
    // A dependency outside the queue is either done or was filtered out by
    // `--req`, and in both cases waiting for it here would deadlock the level.
    dependsOn[req.requirement] = (req.dependsOn || req.depends_on || []).filter((d) =>
      inQueue.has(d)
    );
  }

  const graph = RequirementGraph.fromDependencies(pendingIds, dependsOn);
  return { levels: graph.levels, cycles: graph.cycles, dependsOn, graph };
}

// ── Roles across attempts ────────────────────────────────────────────────────
//
// Today every attempt is identical but for the prompt: same agent, same model,
// carrying the previous failure. That is the one place where changing agent
// genuinely helps, because a second attempt with the same everything is mostly
// a re-roll.
//
// A role is a profile name, not a class. `.harness/profiles.yaml` already maps
// a name to a shell command, so the ladder below is a list of those names and
// the contract "an agent is a shell command" survives untouched.

/** One agent invocation within an attempt. */
export interface AttemptStep {
  /** Profile name, or null for the agent given directly on the command line. */
  profile: string | null;
  /**
   * Advisory steps produce findings for the next step and nothing else: their
   * work is discarded and they can never satisfy the gate. That is the line
   * between this and a committee — `validate --strict-tdd` plus the project's
   * tests stay the only judge.
   */
  advisory: boolean;
}

export interface AttemptPlanOptions {
  /** Profile per attempt. Shorter than `maxAttempts` reuses the last entry. */
  attemptProfiles?: readonly string[];
  /** Advisory profile run before every retry. Never on the first attempt. */
  reviewProfile?: string | null;
}

/**
 * Which agents run, in order, for a given attempt.
 *
 * Attempt 1 is always a single implementing step: there is nothing to review
 * yet. From attempt 2 the review profile, when configured, runs first and its
 * findings feed the step that follows.
 *
 * With no configuration this returns exactly one non-advisory step with no
 * profile for every attempt — today's behaviour, so an existing project sees
 * no change until it asks for one.
 */
export function planAttempt(attempt: number, opts: AttemptPlanOptions = {}): AttemptStep[] {
  const ladder = opts.attemptProfiles ?? [];
  const profile = ladder.length > 0 ? ladder[Math.min(attempt, ladder.length) - 1] : null;

  const steps: AttemptStep[] = [];
  if (attempt > 1 && opts.reviewProfile) {
    steps.push({ profile: opts.reviewProfile, advisory: true });
  }
  steps.push({ profile: profile ?? null, advisory: false });
  return steps;
}
