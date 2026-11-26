import * as fs from "node:fs";
import * as path from "node:path";
import type { DerivationSources, SourceFile } from "../domain/DerivedMatrix";
import { readHarnessConfig } from "./HarnessConfigFile";

/**
 * Reading what a derived matrix is computed from: `spec.md`, every
 * `.feature` under `features/`, and the project's test files.
 *
 * Test files are found by convention, not configuration — the conventions of
 * the stacks `adopt` detects. A team whose tests live elsewhere states the
 * link explicitly (`test=` in the requirement's `specgate:trace`), which is what
 * the gate already accepts.
 */

/** Never descended into: dependencies, build output, and the spec tree itself. */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "out",
  "coverage",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".gradle",
  ".idea",
  ".vscode",
  ".specgate",
  ".specgate",
  ".harness",
  "features",
  "docs",
  "changes",
  "bin",
  "obj",
]);

const TEST_DIR = /^(test|tests|__tests__|testing|integration-tests|e2e)$/i;
/** RSpec's `spec/`: a test folder only at the root — deeper, `spec` names code (REQ-675). */
const ROOT_TEST_DIR = /^(spec|specs)$/i;
const TEST_NAME =
  /([._-](test|spec|it)\.[a-z0-9]+$)|(^test_.*\.py$)|(_test\.(go|py|rb|exs|rs|cc|cpp)$)|((Test|Tests|IT|Spec)\.(java|kt|kts|scala|groovy|cs|swift)$)/;
const CODE_EXT =
  /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts|py|go|rb|java|kt|kts|scala|groovy|cs|fs|swift|rs|php|ex|exs|c|cc|cpp|h|hpp|feature|sh)$/i;
const MAX_BYTES = 1_000_000;
/** `specgate eval`'s exams (REQ-686): fixtures copied for an agent, not code or tests. */
const EVALS_DIR = "evals";
const MAX_FILES = 20_000;

/**
 * Is this a test file by its name — `x.test.ts`, `test_x.py`, `x_test.go`,
 * `XTest.java` — the files a runner runs, not the helpers beside them?
 */
export function isTestByName(rel: string): boolean {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  return CODE_EXT.test(name) && TEST_NAME.test(name);
}

/** Is this a test file by the conventions of the common stacks? */
export function isTestFile(rel: string): boolean {
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  if (!CODE_EXT.test(name)) return false;
  if (TEST_NAME.test(name)) return true;
  // `src/test/java/...` (Maven/Gradle) and plain `test/` or `tests/` trees.
  const dirs = parts.slice(0, -1);
  return dirs.some((p) => TEST_DIR.test(p)) || (dirs.length > 0 && ROOT_TEST_DIR.test(dirs[0]));
}

function walk(root: string, rel: string, pick: (rel: string) => boolean, out: string[]) {
  if (out.length >= MAX_FILES) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      // lab-fixes REQ-696: a skill exam's fixtures, at the root, are not the project.
      if (!rel && e.name === EVALS_DIR) continue;
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(root, childRel, pick, out);
    } else if (e.isFile() && pick(childRel)) {
      out.push(childRel);
    }
  }
}

function read(root: string, rel: string): SourceFile | null {
  try {
    const abs = path.join(root, rel);
    if (fs.statSync(abs).size > MAX_BYTES) return null;
    return { path: rel, source: fs.readFileSync(abs, "utf8") };
  } catch {
    return null;
  }
}

export function readDerivationSources(projectDir: string): DerivationSources {
  const spec = fs.existsSync(path.join(projectDir, "spec.md"))
    ? fs.readFileSync(path.join(projectDir, "spec.md"), "utf8")
    : "";

  const featurePaths: string[] = [];
  walk(path.join(projectDir, "features"), "", (r) => r.endsWith(".feature"), featurePaths);
  const features = featurePaths
    .map((r) => read(projectDir, `features/${r}`))
    .filter((f): f is SourceFile => f !== null);

  // One walk for both: every source file, split by the test convention.
  const sourcePaths: string[] = [];
  walk(projectDir, "", (r) => CODE_EXT.test(r) && !r.endsWith(".feature"), sourcePaths);
  const tests: SourceFile[] = [];
  const code: SourceFile[] = [];
  const tooling = gateTooling(projectDir);
  for (const rel of sourcePaths) {
    if (tooling.has(rel)) continue;
    const f = read(projectDir, rel);
    if (f) (isTestFile(rel) ? tests : code).push(f);
  }

  const capDir = path.join(projectDir, "docs", "specs", "capabilities");
  const capabilities: SourceFile[] = [];
  try {
    for (const e of fs.readdirSync(capDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const f = read(projectDir, `docs/specs/capabilities/${e.name}/spec.md`);
      if (f) capabilities.push(f);
    }
  } catch {
    /* no capability specs: a spec.md-only project */
  }

  return { spec, features, tests, capabilities, code };
}

/**
 * lab-fixes REQ-696: the files the gate's own commands run — `bdd_cmd`,
 * `arch_cmd`, `test_cmd` — are tooling. An example id in a runner's comment
 * made the scenario runner the only code of a requirement.
 */
export function gateTooling(projectDir: string): Set<string> {
  const out = new Set<string>();
  let config: Record<string, unknown> | null = null;
  try {
    config = readHarnessConfig(projectDir) as Record<string, unknown> | null;
  } catch {
    return out;
  }
  for (const key of ["bddCmd", "archCmd", "testCmd"]) {
    const cmd = config && typeof config[key] === "string" ? (config[key] as string) : "";
    for (const word of cmd.split(/\s+/)) {
      const bare = word.replace(/^["']|["']$/g, "");
      if (!bare || bare.startsWith("-") || /[*?{]/.test(bare)) continue;
      const rel = path
        .relative(projectDir, path.resolve(projectDir, bare))
        .split(path.sep)
        .join("/");
      if (rel.startsWith("..")) continue;
      try {
        if (fs.statSync(path.join(projectDir, rel)).isFile()) out.add(rel);
      } catch {
        /* not a file of the project */
      }
    }
  }
  return out;
}
