/**
 * One answer to "how does this project run its tests" (Fase 2.3).
 *
 * There were two, and they disagreed on the same `pom.xml`: `onboard`/`adopt`
 * said `./mvnw -B test`, `harness init` wrote `mvn -B test`. A cold evaluator
 * found it by running both and noticing the mismatch, which is a bad way to
 * learn that a tool has two opinions about your project.
 *
 * The wrapper wins, and not by coin toss. The harness runs each attempt in a
 * bare git worktree; `./mvnw` and `./gradlew` are checked into the repository
 * and work there, while `mvn` and `gradle` depend on what happens to be
 * installed on the machine. Preferring the wrapper is the difference between a
 * gate that runs and a gate that reports "command not found" as a failed
 * attempt and burns one of the agent's three tries on it.
 */

export interface ProjectFiles {
  exists(relPath: string): boolean;
  read(relPath: string): string | null;
}

/**
 * The command that runs this project's tests, or `null` when nothing here says.
 *
 * `null` is a real answer and callers must treat it as one: a project whose
 * test command we cannot infer is not a project with no tests, and guessing
 * `npm test` into a Python repository is how `AI_RULES.md` ended up reading
 * `Testing: unknown` two lines above `Test command: python -m pytest`.
 */
export interface DetectOptions {
  /**
   * Prefer an `npm run verify` script over `npm test` when both exist.
   *
   * The harness wants this and `adopt` does not, and the difference is
   * deliberate rather than accidental — which is the whole point of it being
   * an argument. The harness gates one requirement at a time against a suite
   * that is still incomplete, and in a spec-driven repository `test` often
   * includes the end-to-end run that stays red until the last requirement
   * lands. `verify` is this project's convention for the fast gate.
   *
   * `adopt` is describing the project to a human, so it reports the command
   * the project itself calls its tests.
   */
  preferVerify?: boolean;
}

export function detectTestCommand(files: ProjectFiles, opts: DetectOptions = {}): string | null {
  if (files.exists("package.json")) {
    try {
      const parsed = JSON.parse(files.read("package.json") || "{}");
      const scripts = (parsed && parsed.scripts) || {};
      if (opts.preferVerify && typeof scripts.verify === "string") return "npm run verify";
      // A declared script is the project's own answer and beats any guess.
      if (typeof scripts.test === "string") return "npm test";
    } catch {
      // A malformed package.json is the user's problem, not a reason to fail
      // scaffolding — but it is also not evidence of a test script.
    }
    return "npm test";
  }

  // Wrapper first, everywhere it exists: it is in the repository, so it works
  // in a bare worktree where the system tool may not be installed.
  if (files.exists("pom.xml")) {
    return files.exists("mvnw") ? "./mvnw -B test" : "mvn -B test";
  }
  if (files.exists("build.gradle") || files.exists("build.gradle.kts")) {
    return files.exists("gradlew") ? "./gradlew test" : "gradle test";
  }
  if (files.exists("Cargo.toml")) return "cargo test";
  if (files.exists("go.mod")) return "go test ./...";
  if (files.exists("pyproject.toml") || files.exists("setup.py")) return "pytest";

  return null;
}

/**
 * Does anything in this project execute a `.feature` file?
 *
 * `doctor` reported "every scenario runnable" from a Gherkin *quality* check —
 * When, Then, three steps — on a repository with no BDD runner anywhere, while
 * the harness prompt in the same project said "nothing executes a `.feature`
 * here". A cold evaluator listed the pair as a contradiction, and it is: one of
 * them was describing the file and calling it the run.
 *
 * Shared so the two cannot drift apart again.
 */
export function hasGherkinRunner(files: ProjectFiles): boolean {
  if (files.exists("features/step_definitions")) return true;
  for (const manifest of [
    "package.json",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "pyproject.toml",
  ]) {
    if (!files.exists(manifest)) continue;
    const source = files.read(manifest) || "";
    if (/cucumber|behave|pytest-bdd|godog|specflow|reqnroll|playwright-bdd/i.test(source))
      return true;
  }
  return false;
}
