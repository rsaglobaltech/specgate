import * as fs from "node:fs";
import * as path from "node:path";
import type { DerivationSources, SourceFile } from "../domain/DerivedMatrix";

/**
 * Reading what a derived matrix is computed from: `spec.md`, every
 * `.feature` under `features/`, and the project's test files.
 *
 * Test files are found by convention, not configuration — the conventions of
 * the stacks `adopt` detects. A team whose tests live elsewhere states the
 * link explicitly (`test=` in the requirement's `csda:trace`), which is what
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
  ".csda",
  ".specgate",
  ".harness",
  "features",
  "docs",
  "changes",
  "bin",
  "obj",
]);

const TEST_DIR = /^(test|tests|__tests__|spec|specs|testing|integration-tests|e2e)$/i;
const TEST_NAME =
  /([._-](test|spec|it)\.[a-z0-9]+$)|(^test_.*\.py$)|(_test\.(go|py|rb|exs|rs|cc|cpp)$)|((Test|Tests|IT|Spec)\.(java|kt|kts|scala|groovy|cs|swift)$)/;
const CODE_EXT =
  /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts|py|go|rb|java|kt|kts|scala|groovy|cs|fs|swift|rs|php|ex|exs|c|cc|cpp|h|hpp|feature|sh)$/i;
const MAX_BYTES = 1_000_000;
const MAX_FILES = 20_000;

/** Is this a test file by the conventions of the common stacks? */
export function isTestFile(rel: string): boolean {
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  if (!CODE_EXT.test(name)) return false;
  if (TEST_NAME.test(name)) return true;
  // `src/test/java/...` (Maven/Gradle) and plain `test/` or `tests/` trees.
  return parts.slice(0, -1).some((p) => TEST_DIR.test(p));
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
  for (const rel of sourcePaths) {
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
