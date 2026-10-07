import * as fs from "node:fs";
import * as path from "node:path";
import { error, info } from "../../../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../../../lib/agent";
import { detectStack } from "./AdoptCommand";
import { BaseCommand } from "../../../lib/command";

const COLOR =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR ? "\x1b[0m" : "",
  bold: COLOR ? "\x1b[1m" : "",
  dim: COLOR ? "\x1b[2m" : "",
  green: COLOR ? "\x1b[32m" : "",
  cyan: COLOR ? "\x1b[36m" : "",
};

export const NOT_DOMAIN = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  "vendor",
  ".git",
  ".github",
  ".idea",
  ".vscode",
  ".next",
  ".gradle",
  ".csda",
  ".specops",
  "test",
  "tests",
  "spec",
  "specs",
  "docs",
  "doc",
  "scripts",
  "tools",
  "bin",
  "config",
  "assets",
  "public",
  "static",
  "resources",
  "fixtures",
  "examples",
  "src",
  "main",
  "java",
  "lib",
  "app",
  "internal",
  "pkg",
  "cmd",
  "features",
  "com",
  "org",
  "net",
  "io",
  "migrations",
  "templates",
  "packages",
]);

const DOMAIN_ROOTS = [
  "src/main/java",
  "src/main/kotlin",
  "src/domain",
  "src/modules",
  "src/features",
  "src/contexts",
  "src/app",
  "src/packages",
  "app/domain",
  "domain",
  "modules",
  "contexts",
  "services",
  "internal",
  "pkg",
  "src",
  "app",
  "lib",
];

export const BUILD_OUTPUT = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  "vendor",
  ".gradle",
  ".next",
  ".git",
]);

/** The wrapper a JVM project puts between the module root and its packages. */
const JVM_SOURCE_ROOTS = ["src/main/java", "src/main/kotlin", "src/main/scala", "src/main/groovy"];

const CODE_EXT = new Set([
  ".java",
  ".kt",
  ".kts",
  ".scala",
  ".groovy",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".cs",
  ".fs",
  ".vb",
  ".swift",
  ".dart",
  ".c",
  ".h",
  ".cc",
  ".cpp",
  ".hpp",
  ".m",
  ".mm",
  ".ex",
  ".exs",
  ".erl",
  ".clj",
  ".sql",
]);

/**
 * Files that mark a directory as a project of its own.
 *
 * This is the single most useful signal on disk and the one this command used
 * to ignore: a monorepo almost always *declares* its modules, and a directory
 * carrying its own build manifest is a module by the team's own definition —
 * no guessing, no per-ecosystem parser. It covers Maven and Gradle modules,
 * npm/pnpm workspaces, Cargo workspace members, Go modules, Ruby gems, .NET
 * projects and Composer packages with one rule.
 */
const MODULE_MANIFESTS = [
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "setup.py",
  "composer.json",
  "build.sbt",
  "mix.exs",
];
const MODULE_MANIFEST_GLOBS = [/\.gemspec$/, /\.csproj$/, /\.fsproj$/];

/**
 * Architectural layer names. A repository whose modules are mostly these has
 * declared its *layering*, not its capabilities — `domain`, `application`,
 * `infrastructure`, `bootstrap` are four views of one product. Proposing them
 * as capabilities would be technically accurate and useless, so a layered
 * project is descended into instead.
 */
const LAYER_NAMES = new Set([
  "domain",
  "application",
  "infrastructure",
  "infra",
  "bootstrap",
  "adapters",
  "adapter",
  "ports",
  "api",
  "rest",
  "web",
  "http",
  "ui",
  "persistence",
  "repository",
  "core",
  "common",
  "commons",
  "shared",
  "util",
  "utils",
  "config",
  "client",
  "server",
]);

/**
 * Modules and directories that exist to test, document or demo the real ones.
 *
 * Matched as a whole name, as a prefix (`tests-integration`) and as a suffix
 * (`Serilog.ApprovalTests`), because each ecosystem picks a different one.
 */
const NOT_A_MODULE =
  /^(tests?|testing|it|e2e|integration|benchmarks?|benches|examples?|samples?|demos?|docs?|website|site|fixtures?|testdata|testutil|scripts|tools|buildsrc|build-logic|gradle|third_party|vendor)$|^(tests?|benchmarks?|benches|examples?|samples?|e2e|it)[-_.]|[-_.](tests?|benchmarks?|benches|examples?|samples?|it|approvaltests|testdummies)$/i;

// `integration` is on that list in the singular only. A directory called
// `integration/` holds integration tests in every repository checked; a
// directory called `integrations/` is usually a real capability — the Slack and
// Jira connectors a product actually ships.

export interface Capability {
  id: string;
  title: string;
  evidence: string;
  files: number;
}

interface Module {
  name: string;
  dir: string;
}

function subdirectories(dir: string) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Walk down through single-child directories. A Java package root is
 * `src/main/java/com/acme/`, and stopping at `com` would propose `com` as a
 * capability.
 */
export function descendThroughWrappers(root: string) {
  let current = root;

  // A Maven/Gradle module is `<module>/src/{main,test}/java/...`. The `main` and
  // `test` split means the single-child descent below stops dead at `src`, and
  // both names are in NOT_DOMAIN, so the module reads as empty. Jumping the
  // whole known wrapper is the only way past it. Found on `lixy-api`, where a
  // 299-file hexagonal project proposed nothing at all (H17).
  for (const wrapper of JVM_SOURCE_ROOTS) {
    const candidate = path.join(current, ...wrapper.split("/"));
    if (fs.existsSync(candidate)) {
      current = candidate;
      break;
    }
  }

  // Descend while there is exactly one child: a directory with a single
  // subdirectory is a wrapper, not a choice. Stopping at the first *meaningful*
  // name instead proposed the organisation — `com/acme` yields `acme`, not the
  // packages under it.
  //
  // Build output does not count as a child: whether `build/` exists depends on
  // whether someone compiled, and the proposal must not.
  for (let depth = 0; depth < 8; depth++) {
    const children = subdirectories(current).filter((n) => !BUILD_OUTPUT.has(n.toLowerCase()));
    if (children.length !== 1) return current;
    current = path.join(current, children[0]);
  }
  return current;
}

/**
 * How much code sits under a capability. Only build output is skipped.
 *
 * It used to skip everything in NOT_DOMAIN, which is the right list for *naming*
 * a capability and the wrong one for measuring it: `src`, `main` and `java` are
 * on it, so no JVM layout was ever descended into and every module counted as
 * near zero. Measured on `lakebase-platform`, a 38-file module reported 1 — and
 * since the proposals are sorted by this number, the ranking came out inverted
 * (H14).
 */
function countFiles(dir: string) {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0 && total < 5000) {
    const next = stack.pop()!;
    let entries;
    try {
      entries = fs.readdirSync(next, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        // Tests, samples and benchmarks are code, but they are not the product.
        // Counting them made Nest's dozens of sample apps outweigh the packages
        // they demonstrate.
        if (!BUILD_OUTPUT.has(name) && !name.startsWith(".") && !NOT_A_MODULE.test(entry.name)) {
          stack.push(path.join(next, entry.name));
        }
      } else if (CODE_EXT.has(path.extname(entry.name).toLowerCase())) total++;
    }
  }
  return total;
}

function hasManifest(dir: string) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (MODULE_MANIFESTS.includes(e.name)) return true;
    if (MODULE_MANIFEST_GLOBS.some((re) => re.test(e.name))) return true;
  }
  return false;
}

/**
 * Sibling projects the repository declares by giving each its own build
 * manifest. Looked for one and two levels down, because half of these layouts
 * put them under a container directory (`packages/`, `services/`, `crates/`).
 */
export function findDeclaredModules(projectDir: string): Module[] {
  const found: Module[] = [];
  for (const first of subdirectories(projectDir)) {
    if (BUILD_OUTPUT.has(first.toLowerCase())) continue;
    // `test/`, `examples/` and `sample/` hold real projects with real manifests.
    // Reading them as modules is how Serilog was told its capabilities were its
    // four test assemblies, and Flask that it was three example apps.
    if (NOT_A_MODULE.test(first)) continue;
    const firstPath = path.join(projectDir, first);
    if (hasManifest(firstPath)) {
      found.push({ name: first, dir: firstPath });
      continue;
    }
    // A container like `packages/` carries no manifest of its own; its children do.
    const nested = subdirectories(firstPath)
      .filter((n) => !BUILD_OUTPUT.has(n.toLowerCase()) && !NOT_A_MODULE.test(n))
      .map((n) => ({ name: n, dir: path.join(firstPath, n) }))
      .filter((m) => hasManifest(m.dir));
    found.push(...nested);
  }
  return found.filter((m) => !NOT_A_MODULE.test(m.name) && countFiles(m.dir) > 0);
}

/** True when the modules describe layers of one product rather than areas of it. */
export function looksLayered(modules: Module[]) {
  const layerish = modules.filter((m) => LAYER_NAMES.has(m.name.toLowerCase())).length;
  return layerish >= 2 && layerish / modules.length >= 0.5;
}

/**
 * The top-level Python package — `src/flask/`, `django/` — which is the level a
 * Python project draws its lines at. Nothing else on disk marks it, so the
 * `__init__.py` is the evidence.
 */
function pythonPackageRoots(projectDir: string) {
  const roots: string[] = [];
  for (const container of [projectDir, path.join(projectDir, "src")]) {
    for (const name of subdirectories(container)) {
      if (BUILD_OUTPUT.has(name.toLowerCase()) || NOT_A_MODULE.test(name)) continue;
      if (fs.existsSync(path.join(container, name, "__init__.py"))) {
        roots.push(path.relative(projectDir, path.join(container, name)));
      }
    }
  }
  return roots;
}

export function titleCase(name: string) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function toCapability(projectDir: string, dir: string, name: string): Capability {
  return {
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    title: titleCase(name),
    evidence: path.relative(projectDir, dir).split(path.sep).join("/") || ".",
    files: countFiles(dir),
  };
}

/**
 * Split one directory into the capabilities its children imply, or null when
 * its children imply nothing.
 */
function splitIntoCapabilities(projectDir: string, root: string, depth = 0): Capability[] | null {
  const base = descendThroughWrappers(root);
  const children = subdirectories(base)
    .filter((n) => !NOT_DOMAIN.has(n.toLowerCase()) && !NOT_A_MODULE.test(n))
    .map((n) => ({ dir: path.join(base, n), cap: toCapability(projectDir, path.join(base, n), n) }))
    .filter((child) => child.cap.files > 0);
  if (children.length < 2) return null;

  // A "split" where one child holds nearly everything is not a split — it is a
  // wrapper with debris beside it. Django's repository root looks exactly like
  // this: `django/` plus `js_tests/`, which reads as two capabilities of 929 and
  // 11 files. The lines that matter are drawn one level further in.
  const total = children.reduce((sum, child) => sum + child.cap.files, 0);
  const largest = children.reduce((a, b) => (a.cap.files >= b.cap.files ? a : b));
  if (depth < 3 && largest.cap.files / total >= 0.8) {
    const deeper = splitIntoCapabilities(projectDir, largest.dir, depth + 1);
    if (deeper) return deeper;
  }
  return children.map((child) => child.cap);
}

/**
 * Capabilities proposed from how the code is already organised.
 *
 * Three sources, in order of how much they are actually *evidence*:
 *
 *   1. **Modules the repository declares** by giving each its own build
 *      manifest. Not a heuristic — it is the team's own answer.
 *   2. **The layer where the code divides**, scored across every plausible
 *      root rather than taken from the first entry of a list.
 *   3. Nothing. Silence beats a confident wrong answer, and a flat library
 *      genuinely has no capability structure to read.
 *
 * Measured over sixteen well-known repositories (Maven and Gradle multi-module,
 * npm and pnpm workspaces, Cargo workspaces, Ruby gems, Go, Django, Laravel,
 * .NET), the previous list-order approach answered for five of them and named
 * packaging directories in two more.
 */
export function proposeCapabilities(projectDir: string): Capability[] {
  let modules = findDeclaredModules(projectDir);

  // A repository can hold sub-projects and still *be* a project: Loki keeps a
  // Kubernetes operator and a tiny `pkg/push` module beside the ~4000 files that
  // are Loki itself. Reading those two as the capability list buries the product
  // behind its own accessories, so when the root outweighs everything it
  // declares, the root is the project.
  if (modules.length > 0) {
    const inModules = modules.reduce((sum, m) => sum + countFiles(m.dir), 0);
    if (countFiles(projectDir) - inModules > inModules) modules = [];
  }

  // A layered project (domain / application / infrastructure / bootstrap) has
  // declared how it is built, not what it does. Read its domain layer instead.
  if (modules.length >= 2 && looksLayered(modules)) {
    const layers = modules.slice().sort((a, b) => countFiles(b.dir) - countFiles(a.dir));
    const preferred =
      layers.find((m) => m.name.toLowerCase() === "domain") ||
      layers.find((m) => m.name.toLowerCase() === "core") ||
      layers[0];
    const split = splitIntoCapabilities(projectDir, preferred.dir);
    if (split) return split.sort((a, b) => b.files - a.files).slice(0, 8);
  }

  if (modules.length >= 2) {
    return modules
      .map((m) => toCapability(projectDir, m.dir, m.name))
      .sort((a, b) => b.files - a.files)
      .slice(0, 8);
  }

  // One declared module (a `src/` project, a single .csproj) is the project
  // itself — its own children are where the lines are drawn.
  const searchRoots = modules.length === 1 ? [path.relative(projectDir, modules[0].dir)] : [];
  searchRoots.push(...pythonPackageRoots(projectDir), ...DOMAIN_ROOTS);

  let best: { weight: number; split: Capability[] } | null = null;
  const seen = new Set<string>();
  for (const candidate of searchRoots) {
    const root = path.join(projectDir, candidate);
    const key = path.resolve(root);
    if (seen.has(key) || !fs.existsSync(root)) continue;
    seen.add(key);

    const split = splitIntoCapabilities(projectDir, root);
    if (!split) continue;
    // Weight by the code the split actually accounts for: a packaging folder
    // with two shell scripts must never outrank the crate tree beside it.
    const weight = split.reduce((sum, cap) => sum + cap.files, 0);
    if (!best || weight > best.weight) best = { weight, split };
  }

  if (!best) return [];
  return best.split.sort((a, b) => b.files - a.files).slice(0, 8);
}

function isAdopted(projectDir: string) {
  return fs.existsSync(path.join(projectDir, "spec.md"));
}

/**
 * Resolve symlinks so paths compare equal downstream — macOS `/tmp` is
 * `/private/tmp`, and the JSON contract should not leak that difference.
 * `resolveProjectDir` did this before H16 removed it from onboard's path.
 */
function canonical(p: string) {
  try {
    return fs.realpathSync(path.resolve(p));
  } catch {
    return path.resolve(p);
  }
}

/**
 * The nearest *ancestor* that is already spec-driven, or null.
 *
 * Reported, never substituted: standing in one project and being told about
 * another is how H16 hid an entire Java backend behind its parent repository.
 */
export function findAdoptedAncestor(projectDir: string): string | null {
  let dir = path.dirname(canonical(projectDir));
  const { root } = path.parse(dir);
  for (;;) {
    if (isAdopted(dir)) return dir;
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🧭 onboard${c.reset}  ${c.dim}— the guided tour for an existing repository${c.reset}\n\n` +
      "  USAGE\n    specgate onboard [--project-dir <path>] [--json]\n\n" +
      "  Reads the repository, proposes the capabilities its code already implies,\n" +
      "  and tells you the one command to run next. Writes nothing.\n\n"
  );
}

function renderHuman({
  projectDir,
  adopted,
  adoptedAncestor,
  stack,
  capabilities,
  nextCommand,
}: any) {
  const out = [];
  out.push(`\n  ${c.bold}${c.cyan}🧭 onboarding${c.reset}  ${c.dim}${projectDir}${c.reset}\n`);
  if (adoptedAncestor && !adopted) {
    out.push(
      `  ${c.dim}inside a spec-driven project at ${adoptedAncestor} — reading this directory, not that one${c.reset}\n`
    );
  }

  out.push(`  ${c.bold}1. What this is${c.reset}`);
  out.push(`     stack:  ${stack.STACK}`);
  if (stack.TEST_CMD) out.push(`     tests:  ${stack.TEST_CMD}`);
  out.push(
    `     ${stack.detected ? `${c.dim}detected from ${stack.detected}${c.reset}` : `${c.dim}no manifest found — say so with --var STACK="…"${c.reset}`}`
  );
  out.push("");

  out.push(`  ${c.bold}2. Specs${c.reset}`);
  out.push(
    adopted
      ? `     ${c.green}✔${c.reset} already adopted — spec.md is here`
      : `     ${c.dim}· not adopted yet — \`specgate adopt\` writes the skeleton without touching code${c.reset}`
  );
  out.push("");

  out.push(`  ${c.bold}3. Capabilities this codebase already implies${c.reset}`);
  if (capabilities.length === 0) {
    out.push(`     ${c.dim}Nothing obvious from the layout. Name them yourself — one per`);
    out.push(`     area of behaviour a user would recognise.${c.reset}`);
  } else {
    for (const cap of capabilities) {
      out.push(
        `     ${c.green}·${c.reset} ${cap.title.padEnd(20)} ${c.dim}${cap.evidence}  (${cap.files} files)${c.reset}`
      );
    }
    out.push("");
    out.push(`     ${c.dim}A proposal, not a verdict. Merge, split or rename them.${c.reset}`);
  }
  out.push("");

  out.push(`  ${c.bold}Next${c.reset}`);
  out.push(`     ${c.green}${nextCommand}${c.reset}\n`);
  process.stdout.write(`${out.join("\n")}\n`);
}

export class OnboardCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    const io = agentIo(wantsJson(argv));
    const NULL_SHAPE = { onboarding: null };

    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(EXIT.OK);
    }

    const dirFlag = argv.indexOf("--project-dir");
    const requested = dirFlag !== -1 ? argv[dirFlag + 1] : ".";

    // Unlike every other command, onboard runs on repositories that are not
    // spec-driven yet — that is the whole point — so the usual "walk up until
    // you find spec.md" resolution is actively wrong here: from an un-adopted
    // sub-project it lands on the adopted ancestor and silently reports a
    // *different* codebase. On `lixi-platform/lixy-api` it answered with the
    // parent's dead TypeScript, stack and all (H16). Take the directory asked
    // for, and mention the ancestor rather than substituting it.
    const projectDir = canonical(requested);
    const adoptedAncestor = findAdoptedAncestor(projectDir);

    if (!fs.existsSync(projectDir)) {
      io.usage(NULL_SHAPE, [
        error("project_dir_not_found", `Directory not found: ${projectDir}`, {
          fix: "Point --project-dir at the repository you want to onboard.",
        }),
      ]);
    }

    const adopted = isAdopted(projectDir);
    const stack = detectStack(projectDir);
    const capabilities = proposeCapabilities(projectDir);

    const nextCommand = !adopted
      ? "specgate adopt"
      : capabilities.length > 0
        ? `specgate change new describe-${capabilities[0].id}`
        : 'specgate new "<the first behaviour you rely on>"';

    const diagnostics = [];
    if (!stack.detected) {
      diagnostics.push(
        info("stack_undetected", "Could not detect the stack from a manifest file.", {
          fix: 'Pass it explicitly: specgate adopt --var STACK="…" --var TEST_CMD="…"',
        })
      );
    }
    if (capabilities.length === 0) {
      diagnostics.push(
        info("capabilities_undetected", "No capability structure was obvious from the layout.", {
          fix: "Name them yourself — one per area of behaviour a user would recognise. `specgate change new <id>` opens the first.",
        })
      );
    }

    if (adoptedAncestor && !adopted) {
      diagnostics.push(
        info(
          "adopted_ancestor",
          `This directory sits inside a spec-driven project at ${adoptedAncestor}, which was NOT onboarded.`,
          {
            target: adoptedAncestor,
            fix: `Onboarding ${projectDir}. To read the parent instead: specgate onboard --project-dir ${adoptedAncestor}`,
          }
        )
      );
    }

    io.emit(
      {
        onboarding: {
          projectDir,
          adopted,
          adoptedAncestor,
          stack: {
            name: stack.STACK,
            testing: stack.TESTING,
            testCommand: stack.TEST_CMD,
            detectedFrom: stack.detected || null,
          },
          capabilities,
          nextCommand,
        },
        status: diagnostics,
      },
      () => renderHuman({ projectDir, adopted, adoptedAncestor, stack, capabilities, nextCommand })
    );
    process.exit(EXIT.OK);
  }
}
