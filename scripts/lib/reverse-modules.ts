/**
 * The modules of an existing system, as `specgate reverse` sees them (REQ-528).
 *
 * One module per run is the unit of reversing: small enough for a person to
 * review what the agent read from it before the next one. The candidates are
 * what the repository already declares — a directory with its own build
 * manifest (Maven and Gradle modules, npm workspaces, Go modules, …, found the
 * way `onboard` finds them), the packages of a Go module, and the first-level
 * folders under `src/` or `apps/` that hold code.
 *
 * No agent runs here: listing is reading the tree.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  BUILD_OUTPUT,
  CODE_EXT,
  findDeclaredModules,
} from "../cli/commands/project/OnboardCommand";

export interface ReverseModule {
  /** What `specgate reverse <name>` takes; also names the change. */
  readonly name: string;
  /** Relative to the project, with forward slashes. */
  readonly path: string;
  /** The language most of its code is in. */
  readonly stack: string;
  /** Its code files, tests included. */
  readonly files: number;
}

const STACK_OF: Record<string, string> = {
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".groovy": "groovy",
  ".ts": "node",
  ".tsx": "node",
  ".js": "node",
  ".jsx": "node",
  ".mjs": "node",
  ".cjs": "node",
  ".vue": "node",
  ".svelte": "node",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "dotnet",
  ".fs": "dotnet",
  ".vb": "dotnet",
  ".swift": "swift",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
};

/** Schema files the prompt reads too: they say what the data is. */
const SCHEMA_EXT = new Set([".sql", ".graphql", ".gql", ".proto", ".prisma", ".avsc"]);

const rel = (projectDir: string, abs: string) =>
  path.relative(projectDir, abs).split(path.sep).join("/");

/** Every code and schema file under a directory, build output and dot-folders skipped, sorted. */
export function moduleFiles(dir: string, limit = 5000): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0 && out.length < limit) {
    const next = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(next, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(next, e.name);
      if (e.isDirectory()) {
        if (!BUILD_OUTPUT.has(e.name.toLowerCase()) && !e.name.startsWith(".")) stack.push(full);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (CODE_EXT.has(ext) || SCHEMA_EXT.has(ext)) out.push(full);
      }
    }
  }
  return out.sort();
}

/** The stack most of these files are written in; `unknown` when none is recognised. */
function stackOf(files: string[]): string {
  const counts = new Map<string, number>();
  for (const f of files) {
    const s = STACK_OF[path.extname(f).toLowerCase()];
    if (s) counts.set(s, (counts.get(s) || 0) + 1);
  }
  let best = "unknown";
  let most = 0;
  for (const [s, n] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (n > most) [best, most] = [s, n];
  }
  return best;
}

function subdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) => e.isDirectory() && !e.name.startsWith(".") && !BUILD_OUTPUT.has(e.name.toLowerCase())
      )
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/** The packages of a Go module at the root: its folders, and those under cmd/, internal/ and pkg/. */
function goPackages(projectDir: string): string[] {
  if (!fs.existsSync(path.join(projectDir, "go.mod"))) return [];
  const containers = new Set(["cmd", "internal", "pkg"]);
  const out: string[] = [];
  for (const d of subdirs(projectDir)) {
    const name = path.basename(d);
    if (containers.has(name)) out.push(...subdirs(d));
    else out.push(d);
  }
  return out.filter((d) => moduleFiles(d).some((f) => f.endsWith(".go")));
}

/** The candidate modules, sorted by path. */
export function reverseModules(projectDir: string): ReverseModule[] {
  const dirs = new Set<string>();
  for (const m of findDeclaredModules(projectDir)) dirs.add(path.resolve(m.dir));
  for (const d of goPackages(projectDir)) dirs.add(path.resolve(d));
  for (const container of ["src", "apps"]) {
    for (const d of subdirs(path.join(projectDir, container))) {
      if (moduleFiles(d).length > 0) dirs.add(path.resolve(d));
    }
  }
  return [...dirs]
    .map((d) => {
      const files = moduleFiles(d);
      return {
        name: path.basename(d),
        path: rel(projectDir, d),
        stack: stackOf(files),
        files: files.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase())).length,
      };
    })
    .filter((m) => m.files > 0 && m.path !== "")
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** The change a module is reversed into. */
export function reverseChangeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `reverse-${slug || "module"}`;
}
