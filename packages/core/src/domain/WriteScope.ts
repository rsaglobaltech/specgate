/**
 * What the agent was allowed to write — checked, not merely asked for (A1, H16).
 *
 * ## The hole this closes
 *
 * The prompt tells the agent not to touch the spec. Nothing verified it. An
 * agent that cannot make a scenario pass can instead relax the scenario, or add
 * a permissive line to `AI_RULES.md`, and the gate approves: `validate
 * --strict-tdd` checks that the feature **exists** and is in the matrix, never
 * that it still **says what it said before**.
 *
 * That is not a hypothetical. It is precisely the failure this product claims
 * to prevent — "specs as executable contracts" stops being true the moment the
 * executor can edit the contract. Same family as H1, H14 and H15: the gate
 * approving without having verified.
 *
 * ## Why a new file is not a violation
 *
 * A requirement in category `NEEDS_FEATURE` is *supposed* to create its feature
 * file, so a blanket ban on `features/**` would fail the legitimate case. The
 * distinction A1 asks for — creating a file that did not exist is fine,
 * modifying one that did is not — is one git already draws for us: an untracked
 * path is new, a tracked change is an edit. No heuristics required.
 *
 * The exception is safe in the direction that matters. A matrix row points the
 * gate at one specific feature file, so a *new* file cannot loosen the contract
 * the gate is running; deleting the declared feature and writing a fresh one in
 * its place shows up as a tracked deletion, and is refused.
 *
 * ## Why this module holds no git
 *
 * Deciding whether `features/core/health.feature` is protected is a rule.
 * Finding out which paths changed is I/O. Keeping them apart is what lets every
 * case below be tested without a repository, an agent, or twenty minutes.
 */

/**
 * Protected unless the project says otherwise.
 *
 * Everything here is a term of the contract the agent is working *against*:
 * the business manifesto, the execution rules, the scenarios that decide pass
 * or fail, the specification documents, the pack lockfile, and the harness
 * configuration itself — an agent that may edit `harness.config.yaml` may
 * disable its own gate.
 */
export const DEFAULT_PROTECTED_PATHS: readonly string[] = Object.freeze([
  "spec.md",
  "AGENTS.md",
  "AI_RULES.md",
  "features/**/*.feature",
  "docs/specs/**",
  ".specops.lock",
  "harness.config.yaml",
]);

export interface WriteScopeChanges {
  /** Tracked paths the agent changed, deleted or renamed — files that already existed. */
  readonly modified: readonly string[];
  /** Paths that did not exist at the base commit. */
  readonly added: readonly string[];
}

export interface WriteScopeRules {
  readonly protectedPaths?: readonly string[];
  /** An explicit escape hatch. Never silent: it has to be written down. */
  readonly allowPaths?: readonly string[];
}

export interface WriteScopeViolation {
  readonly path: string;
  /** The pattern that protects it, so the report can say *why*. */
  readonly pattern: string;
}

/**
 * Glob matching, in the small dialect these patterns actually use.
 *
 * `**` crosses directory separators, `*` does not, `?` is one character. Enough
 * for `features/**\/*.feature` and `docs/specs/**`, and no more: this package
 * has no runtime dependencies (the CLI runs through `npx` on other people's
 * machines), so a matcher is written rather than installed.
 *
 * A pattern naming a directory — `docs/specs/**` — also matches the directory
 * itself, because a person writing that means "this subtree".
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  const normalise = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");
  const target = normalise(filePath);
  const glob = normalise(pattern);

  const source = glob.split("").reduce<{ out: string; i: number }>(
    (acc, _ch, i, chars) => {
      if (i < acc.i) return acc;
      const rest = chars.slice(i).join("");
      if (rest.startsWith("**/")) return { out: acc.out + "(?:.*/)?", i: i + 3 };
      if (rest.startsWith("**")) return { out: acc.out + ".*", i: i + 2 };
      const ch = chars[i];
      if (ch === "*") return { out: acc.out + "[^/]*", i: i + 1 };
      if (ch === "?") return { out: acc.out + "[^/]", i: i + 1 };
      return { out: acc.out + ch.replace(/[.+^${}()|[\]\\]/g, "\\$&"), i: i + 1 };
    },
    { out: "", i: 0 }
  ).out;

  if (new RegExp(`^${source}$`).test(target)) return true;

  // `docs/specs/**` means the subtree, and a person writing it means the
  // directory too. Without this, `docs/specs` itself slips through.
  if (glob.endsWith("/**")) {
    const dir = glob.slice(0, -3);
    return target === dir || target.startsWith(`${dir}/`);
  }
  return false;
}

/** The first protecting pattern, or `null` when the path is not protected. */
export function protectingPattern(filePath: string, rules: WriteScopeRules = {}): string | null {
  const allow = rules.allowPaths || [];
  if (allow.some((pattern) => matchesGlob(filePath, pattern))) return null;

  const guarded = rules.protectedPaths || DEFAULT_PROTECTED_PATHS;
  return guarded.find((pattern) => matchesGlob(filePath, pattern)) || null;
}

/**
 * Which of the agent's writes were out of scope.
 *
 * `added` paths are never violations — see the module note on `NEEDS_FEATURE`.
 * Ordered by path so a report reads the same twice.
 */
export function checkWriteScope(
  changes: WriteScopeChanges,
  rules: WriteScopeRules = {}
): WriteScopeViolation[] {
  const violations: WriteScopeViolation[] = [];
  for (const filePath of [...changes.modified].sort()) {
    const pattern = protectingPattern(filePath, rules);
    if (pattern) violations.push({ path: filePath, pattern });
  }
  return violations;
}

/**
 * `git status --porcelain`, split into what was edited and what is new.
 *
 * Parsing the status codes rather than guessing from the path is the lesson
 * `change author` taught the hard way: it ran `git checkout` on everything and
 * deleted the files that had never been tracked. `??` means new; every other
 * code means the file existed and the agent changed it — including `D`
 * (deleted) and both halves of a rename, which are edits to the contract by any
 * reading.
 */
export function parseGitStatus(porcelain: string): WriteScopeChanges {
  const modified: string[] = [];
  const added: string[] = [];

  for (const raw of porcelain.split("\n")) {
    if (!raw.trim()) continue;
    const code = raw.slice(0, 2);
    const rest = raw.slice(3);
    if (code === "??") {
      added.push(rest.trim());
      continue;
    }
    // `R  old -> new`: both sides are edits to something that existed.
    if (rest.includes(" -> ")) {
      const [from, to] = rest.split(" -> ");
      modified.push(from.trim(), to.trim());
      continue;
    }
    modified.push(rest.trim());
  }
  return { modified, added };
}

const TRACE_LINE = /^<!--\s*csda:trace\b.*-->\s*$/;
const withoutStatus = (line: string) =>
  line
    .replace(/\s+status=("[^"]*"|'[^']*'|\S+)/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Whether a unified diff (`git diff -U0`) changes nothing but the `status=` of
 * `csda:trace` lines — exactly what `specgate done` writes.
 *
 * The harness prompt tells the agent to close its requirement with `done`, and
 * `done` records the status in the capability spec. Write-scope then rejected
 * the attempt as an edit to `docs/specs/**` (reservas_app, #56) — a rule the
 * harness's own instruction broke. Any other change to the line, or to any
 * other line, is still an edit to the contract.
 */
export function onlyTraceStatusChanged(diff: string): boolean {
  const removed: string[] = [];
  const added: string[] = [];
  for (const line of diff.split("\n")) {
    if (/^(---|\+\+\+|@@|diff |index )/.test(line)) continue;
    if (line.startsWith("-")) removed.push(line.slice(1));
    else if (line.startsWith("+")) added.push(line.slice(1));
  }
  if (removed.length === 0 || removed.length !== added.length) return false;
  return removed.every(
    (r, i) =>
      TRACE_LINE.test(r.trim()) &&
      TRACE_LINE.test(added[i].trim()) &&
      withoutStatus(r) === withoutStatus(added[i])
  );
}
