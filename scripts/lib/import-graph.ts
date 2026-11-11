/**
 * The project's JavaScript and TypeScript files and what each imports, read
 * once per check (REQ-510, REQ-516).
 *
 * `check --affected` adds the tests whose imports reach a changed file; the
 * result cache hashes what a test imports. Both need the same graph, and both
 * need to know where it stops: an import nobody can follow, or a file that
 * reaches the file system, a process or the network.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { builtinModules } from "node:module";
import {
  SCANNED,
  candidatePaths,
  isRelative,
  packageName,
  reachesBeyondImports,
  scanImports,
} from "../../packages/core/src/domain/ImportScan";

const BUILTIN = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));
/** A file bigger than this is not scanned: it is generated, and treated as unknown. */
const MAX_BYTES = 1_000_000;

interface Node {
  /** The project files it imports, resolved. */
  deps: string[];
  /** An import it has that cannot be followed. */
  opaque: boolean;
  /** It reaches the file system, a process or the network. */
  beyond: boolean;
}

export interface Closure {
  /** Every project file the test reaches through imports, itself included. */
  files: string[];
  /** Some import on the way cannot be followed. */
  opaque: boolean;
  /** Some file on the way reaches what imports do not name. */
  beyond: boolean;
}

export class ImportGraph {
  private readonly nodes = new Map<string, Node | null>();
  private readonly installed = new Map<string, boolean>();
  private readonly closures = new Map<string, Closure>();

  /** `files`: every file of the project, project-relative with `/`. */
  constructor(
    private readonly projectDir: string,
    private readonly files: ReadonlySet<string>
  ) {}

  /** Is the package installed where Node would find it from the project? */
  private isInstalled(name: string): boolean {
    let known = this.installed.get(name);
    if (known !== undefined) return known;
    known = false;
    for (let at = path.resolve(this.projectDir); ;) {
      if (fs.existsSync(path.join(at, "node_modules", ...name.split("/")))) {
        known = true;
        break;
      }
      const up = path.dirname(at);
      if (up === at) break;
      at = up;
    }
    this.installed.set(name, known);
    return known;
  }

  /** The file's own imports, read once; null for a file that cannot be read. */
  private node(rel: string): Node | null {
    if (this.nodes.has(rel)) return this.nodes.get(rel) || null;
    let node: Node | null = null;
    try {
      const abs = path.join(this.projectDir, ...rel.split("/"));
      if (fs.statSync(abs).size <= MAX_BYTES) {
        const source = fs.readFileSync(abs, "utf8");
        const scan = scanImports(source);
        node = {
          deps: [],
          opaque: scan.dynamic,
          beyond: reachesBeyondImports(scan.specifiers, source),
        };
        for (const spec of scan.specifiers) {
          if (isRelative(spec)) {
            const hit = candidatePaths(rel, spec).find((c) => this.files.has(c));
            if (hit) node.deps.push(hit);
            else node.opaque = true;
            continue;
          }
          const name = packageName(spec);
          if (spec.startsWith("node:") || (name !== null && BUILTIN.has(name))) continue;
          // An alias (`@/x`, `#x`, a tsconfig path) names a project file nobody can resolve here.
          if (name === null || !this.isInstalled(name)) node.opaque = true;
        }
      }
    } catch {
      node = null;
    }
    this.nodes.set(rel, node);
    return node;
  }

  /** What a file reaches through its imports. */
  closure(rel: string): Closure {
    const known = this.closures.get(rel);
    if (known) return known;
    const seen = new Set<string>();
    let opaque = false;
    let beyond = false;
    const stack = [rel];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (seen.has(at)) continue;
      seen.add(at);
      // A test in another language: nothing here can follow what it reaches.
      if (!SCANNED.test(at)) {
        if (at === rel) opaque = true;
        continue;
      }
      const node = this.node(at);
      if (!node) {
        opaque = true;
        continue;
      }
      opaque = opaque || node.opaque;
      beyond = beyond || node.beyond;
      for (const d of node.deps) if (!seen.has(d)) stack.push(d);
    }
    const out = { files: [...seen].sort(), opaque, beyond };
    this.closures.set(rel, out);
    return out;
  }

  /** For each file, the tests among `tests` whose imports reach it. */
  importedBy(tests: readonly string[]): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const t of tests) {
      if (!SCANNED.test(t)) continue;
      for (const f of this.closure(t).files) {
        if (f === t) continue;
        const list = out.get(f);
        if (list) list.push(t);
        else out.set(f, [t]);
      }
    }
    return out;
  }
}
