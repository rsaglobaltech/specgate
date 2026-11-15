/**
 * Which tests a change needs (REQ-510 … REQ-513).
 *
 * The gate ran the whole suite every time, and `apply` runs the gate once per
 * requirement: building N requirements cost N runs of a suite that grows with
 * N. `check --affected` runs what the change touches instead — and, because a
 * wrong skip is worse than a slow run, the whole suite whenever it cannot say
 * what that is: a file every test depends on changed, a file no requirement,
 * test or import links to changed, nothing changed, or nothing it found has a
 * test. Each of those says why.
 *
 * Pure: the caller reads git, the matrix and the imports, and hands them over.
 */

import { matchesGlob } from "./WriteScope";

export type ChangeKind = "added" | "modified" | "deleted";

export interface ChangedFile {
  /** Project-relative, `/`-separated. */
  path: string;
  kind: ChangeKind;
  /**
   * The lines of the file as it is now that the change wrote (1-based), or
   * null when every line counts — a new or untracked file.
   */
  lines: number[] | null;
  /** The text of the lines the change removed or wrote, for the ids they name. */
  text: string;
}

/** One row of the matrix, as `matrix.scenarios` gives it (REQ-498). */
export interface MatrixLinks {
  requirement: string;
  feature: string | null;
  tests: readonly string[];
  code: readonly string[];
}

export interface AffectedInput {
  changed: readonly ChangedFile[];
  rows: readonly MatrixLinks[];
  /** The current text of each changed spec or feature file that still exists. */
  texts: ReadonlyMap<string, string>;
  /**
   * Is this a test file a runner runs — `x.test.ts`, `test_x.py`, `XTest.java`?
   * A helper or a fixture beside the tests is not: it is reached through the
   * tests that import it.
   */
  isTest: (path: string) => boolean;
  /** Does this test file exist now? */
  exists: (path: string) => boolean;
  /**
   * The test files whose imports reach each file (JavaScript and TypeScript),
   * tests that cannot be followed included; absent for a file nothing scans.
   */
  importedBy: ReadonlyMap<string, readonly string[]>;
  /** `full_on:` in harness.config.yaml. */
  fullOn: readonly string[];
}

export type SelectionMode = "affected" | "full";

/** Why the whole suite runs, for the fix that goes with it. */
export type FullCause =
  | "nothing-changed"
  | "no-base"
  | "global"
  | "removed"
  | "unlinked"
  | "no-tests"
  | "no-files"
  | "too-long";

export interface AffectedSelection {
  mode: SelectionMode;
  reason: string;
  /** Set when `mode` is `full`. */
  cause?: FullCause;
  requirements: string[];
  tests: string[];
}

/** Files every test can depend on, by name: a change to one runs the whole suite (REQ-511). */
const GLOBAL_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "bun.lock",
  "bun.lockb",
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  ".nvmrc",
  ".node-version",
  ".tool-versions",
  "harness.config.yaml",
  "jsconfig.json",
  "deno.json",
  "deno.jsonc",
  "deno.lock",
  ".babelrc",
  ".swcrc",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "gradle.properties",
  "gradle-wrapper.properties",
  "gradle.lockfile",
  "Makefile",
  "CMakeLists.txt",
  "go.mod",
  "go.sum",
  "go.work",
  "Cargo.toml",
  "Cargo.lock",
  "pyproject.toml",
  "poetry.lock",
  "Pipfile",
  "Pipfile.lock",
  "uv.lock",
  "setup.py",
  "setup.cfg",
  "tox.ini",
  "pytest.ini",
  "conftest.py",
  "noxfile.py",
  "Gemfile",
  "Gemfile.lock",
  ".rspec",
  "composer.json",
  "composer.lock",
  "phpunit.xml",
  "phpunit.xml.dist",
  "mix.exs",
  "mix.lock",
  "global.json",
  "nuget.config",
  "Directory.Build.props",
  "Directory.Build.targets",
  "Directory.Packages.props",
]);

const GLOBAL_PATTERNS = [
  /^tsconfig(\..+)?\.json$/,
  /^requirements.*\.txt$/,
  /\.(csproj|fsproj|vbproj|sln)$/,
  /^\.env(\..+)?$/,
  /^(jest|vitest|vite|webpack|rollup|babel|playwright|cypress|karma|mocha|ava|esbuild|tsup|swc|stryker|cucumber|wdio|nightwatch|next|nuxt|svelte|astro|remix|metro)\.config\.[cm]?[jt]sx?$/,
  /^karma\.conf\.[cm]?[jt]s$/,
  /^\.(mocharc|babelrc|c8rc|nycrc)(\..+)?$/,
  /^cucumber\.(js|cjs|mjs|json|ya?ml)$/,
];

/** The name of the file `path` is, when a change to it runs the whole suite. */
export function globalFile(path: string, fullOn: readonly string[] = []): string | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (GLOBAL_NAMES.has(name) || GLOBAL_PATTERNS.some((p) => p.test(name))) return path;
  return fullOn.some((glob) => matchesGlob(path, glob)) ? path : null;
}

/** Text no test reads: documentation and the repository's own housekeeping. */
const INERT_DIRS = /^(\.github|\.gitlab|\.vscode|\.idea|\.claude|\.cursor|\.specgate|\.harness)\//;
const INERT_EXT = /\.(md|mdx|markdown|rst|adoc|txt)$/i;
const INERT_NAMES =
  /^(LICEN[CS]E|NOTICE|AUTHORS|CODEOWNERS|CONTRIBUTORS|\.gitignore|\.gitattributes|\.editorconfig|\.mailmap)(\..*)?$/i;

/** A file whose change no test can see, unless a test imports it. */
export function inertFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return INERT_DIRS.test(path) || INERT_EXT.test(name) || INERT_NAMES.test(name);
}

/** `spec.md`, or a Markdown file of the spec tree: capabilities, change deltas, the matrix. */
export function specFile(path: string): boolean {
  return path === "spec.md" || (path.startsWith("docs/specs/") && /\.md$/i.test(path));
}

const REQUIREMENT_HEADING = /^(#{2,4})\s+(.*)$/;
const SCENARIO_HEADING = /^(scenario|escenario|example|ejemplo)\b/i;
const REQ_ID = /(?<![A-Za-z0-9])REQ-[A-Za-z0-9.]*[A-Za-z0-9]/g;

/** The ids written on these lines. */
function idsIn(text: string): string[] {
  return [...new Set(text.match(REQ_ID) || [])];
}

/**
 * The requirements whose section in a spec file holds one of `lines`: a
 * section runs from its requirement heading to the next heading of its level
 * or above, its scenarios inside it.
 */
export function sectionsAt(text: string, lines: readonly number[] | null): string[] {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const wanted = lines === null ? null : new Set(lines);
  const found = new Set<string>();
  let level = 0;
  let ids: string[] = [];
  for (let i = 0; i < all.length; i++) {
    const line = all[i].trim();
    const m = REQUIREMENT_HEADING.exec(line);
    if (m && !SCENARIO_HEADING.test(m[2])) {
      const named = idsIn(m[2]);
      if (named.length > 0) {
        level = m[1].length;
        ids = named;
      } else if (ids.length > 0 && m[1].length <= level) {
        ids = [];
      }
    } else if (/^#\s+\S/.test(line)) {
      ids = [];
    }
    if (ids.length > 0 && (wanted === null || wanted.has(i + 1))) {
      for (const id of ids) found.add(id);
    }
  }
  return [...found];
}

/** `@REQ-001` tags anywhere in a feature file. */
function tagsIn(text: string): string[] {
  return [...new Set((text.match(/@REQ-[A-Za-z0-9.]*[A-Za-z0-9]/g) || []).map((t) => t.slice(1)))];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Which tests the change needs, or the whole suite and why. */
export function selectAffected(input: AffectedInput): AffectedSelection {
  const full = (
    cause: FullCause,
    reason: string,
    requirements: Iterable<string> = []
  ): AffectedSelection => ({
    mode: "full",
    reason,
    cause,
    requirements: [...new Set(requirements)].sort(),
    tests: [],
  });
  if (input.changed.length === 0) return full("nothing-changed", "nothing changed since the base");

  // REQ-511: one global file is enough; name the first, in path order.
  for (const f of [...input.changed].sort((a, b) => a.path.localeCompare(b.path))) {
    const g = globalFile(f.path, input.fullOn);
    if (g) return full("global", `${g} changed, and every test can depend on it`);
  }

  const byCode = new Map<string, Set<string>>();
  const byTest = new Map<string, Set<string>>();
  const testsOf = new Map<string, Set<string>>();
  const known = new Set<string>();
  const link = (map: Map<string, Set<string>>, key: string, value: string) => {
    const set = map.get(key) || new Set<string>();
    set.add(value);
    map.set(key, set);
  };
  for (const row of input.rows) {
    known.add(row.requirement);
    for (const c of row.code) link(byCode, c, row.requirement);
    for (const t of row.tests) {
      link(byTest, t, row.requirement);
      link(testsOf, row.requirement, t);
    }
  }

  const requirements = new Set<string>();
  const tests = new Set<string>();
  const unlinked: string[] = [];
  const removed: string[] = [];

  for (const f of input.changed) {
    const importers = input.importedBy.get(f.path) || [];
    for (const t of importers) tests.add(t);
    if (specFile(f.path)) {
      const text = input.texts.get(f.path);
      const lines = f.kind === "added" ? null : f.lines;
      for (const id of text !== undefined ? sectionsAt(text, lines) : []) requirements.add(id);
      for (const id of idsIn(f.text)) requirements.add(id);
      continue;
    }
    if (/\.feature$/i.test(f.path)) {
      for (const id of tagsIn(input.texts.get(f.path) || "")) requirements.add(id);
      for (const id of tagsIn(f.text)) requirements.add(id);
      continue;
    }
    const linkedAsTest = byTest.get(f.path);
    if (linkedAsTest || input.isTest(f.path)) {
      for (const r of linkedAsTest || []) requirements.add(r);
      if (f.kind !== "deleted") tests.add(f.path);
      continue;
    }
    const linkedAsCode = byCode.get(f.path);
    if (linkedAsCode) {
      for (const r of linkedAsCode) requirements.add(r);
      continue;
    }
    if (importers.length > 0 || inertFile(f.path)) continue;
    if (f.kind === "deleted") removed.push(f.path);
    else unlinked.push(f.path);
  }

  // REQ-512: a file nothing links to may be what any test depends on.
  if (removed.length > 0) {
    return full(
      "removed",
      `${removed[0]} was removed${removed.length > 1 ? ` (and ${plural(removed.length - 1, "more file")})` : ""}, and no requirement, test or import says which tests used it`,
      requirements
    );
  }
  if (unlinked.length > 0) {
    return full(
      "unlinked",
      `${unlinked[0]} changed${unlinked.length > 1 ? ` (and ${plural(unlinked.length - 1, "more file")})` : ""}, and no requirement, test or import links it to a test`,
      requirements
    );
  }

  const touched = [...requirements].filter((r) => known.has(r)).sort();
  for (const r of touched) for (const t of testsOf.get(r) || []) tests.add(t);
  const runnable = [...tests].filter((t) => input.exists(t)).sort();
  if (runnable.length === 0) {
    return full(
      "no-tests",
      touched.length > 0
        ? `no test file is linked to ${touched.length === 1 ? touched[0] : plural(touched.length, "touched requirement")}`
        : "nothing that changed is linked to a requirement or a test",
      touched
    );
  }
  return {
    mode: "affected",
    reason: `${plural(touched.length, "requirement")} touched, ${plural(runnable.length, "test file")} to run`,
    requirements: touched,
    tests: runnable,
  };
}

/** What a filled test command could not take, said as the reason the whole suite ran instead. */
export interface FilledCommand {
  command: string;
  /** Null when it was filled; else why the whole suite runs. */
  fullBecause: string | null;
  cause: FullCause | null;
  /** The code of the finding that says how to fix it, when there is one. */
  finding: "affected_needs_files" | null;
}

/** A command line longer than this is refused by cmd.exe (8,191) — with room for the shell's own. */
const MAX_COMMAND = { win32: 8000, other: 100_000 };

/**
 * The test command for the tests selected (REQ-513): `{files}` the selected
 * files, each quoted by `quote`; `{req}` the one requirement touched, or
 * empty. With neither placeholder, or `{req}` alone and several requirements
 * touched, it runs whole — and says why.
 */
export function fillTestCommand(
  template: string,
  selection: Pick<AffectedSelection, "mode" | "requirements" | "tests">,
  quote: (arg: string) => string,
  platform: string
): FilledCommand {
  const fill = (files: string, req: string) =>
    template
      .split("{files}")
      .join(files)
      .split("{req}")
      .join(req)
      .split("{scenario}")
      .join("")
      .split("{feature_file}")
      .join("")
      .replace(/[ \t]+$/gm, "")
      .trim();
  const whole = fill("", "");
  if (selection.mode === "full") {
    return { command: whole, fullBecause: null, cause: null, finding: null };
  }
  const one = selection.requirements.length === 1 ? selection.requirements[0] : "";
  if (template.includes("{files}")) {
    const command = fill(selection.tests.map(quote).join(" "), one);
    const max = platform === "win32" ? MAX_COMMAND.win32 : MAX_COMMAND.other;
    if (command.length > max) {
      return {
        command: whole,
        fullBecause: `the ${plural(selection.tests.length, "test file")} do not fit on one command line`,
        cause: "too-long",
        finding: null,
      };
    }
    return { command, fullBecause: null, cause: null, finding: null };
  }
  if (template.includes("{req}")) {
    if (one) return { command: fill("", one), fullBecause: null, cause: null, finding: null };
    return {
      command: whole,
      fullBecause: `{req} names one requirement and ${plural(selection.requirements.length, "is", "are")} touched`,
      cause: "no-files",
      finding: "affected_needs_files",
    };
  }
  return {
    command: whole,
    fullBecause: "the test command takes no {files}",
    cause: "no-files",
    finding: "affected_needs_files",
  };
}
