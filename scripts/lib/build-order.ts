/**
 * REQ-600: the order requirements are built in. With a brief that lists its
 * modules, a module's requirements come in the brief's order — the order the
 * person wrote them, usually because one needs the one before — and within a
 * module, in the order its spec lists them. Without a brief, the matrix's
 * order, as before. `depends=` still wins in the harness, which waits on it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { briefModules } from "../../packages/core/src/domain/DraftChecklist";

const BRIEF = path.join("docs", "brief.md");
const CHANGES = path.join("docs", "specs", "changes");
const CAPABILITIES = path.join("docs", "specs", "capabilities");

/** A requirement's module of the brief, and where that module stands in it. */
export interface ModulePlace {
  module: string;
  /** 0 for the brief's first module. */
  rank: number;
  of: number;
}

const read = (file: string): string => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

const dirs = (dir: string): string[] => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
};

/** The requirement ids a spec or delta declares in its headings. */
function declared(spec: string): string[] {
  const ids: string[] = [];
  for (const m of spec.matchAll(/^#{2,4}\s+(?:Requirement:\s*)?(REQ-\d+)\b/gm)) ids.push(m[1]);
  return ids;
}

/**
 * The module of the brief each requirement belongs to: the requirements of its
 * draft (`draft-<module>`, open or archived) and of the capabilities that draft
 * wrote, or of a capability named as the module. Empty without a brief.
 */
export function modulePlaces(projectDir: string): Map<string, ModulePlace> {
  const places = new Map<string, ModulePlace>();
  const modules = briefModules(read(path.join(projectDir, BRIEF)));
  if (modules.length === 0) return places;
  const archive = path.join(projectDir, CHANGES, "archive");
  const archived = dirs(archive);
  modules.forEach((module, rank) => {
    const draft = `draft-${module}`;
    const changeDirs = [
      path.join(projectDir, CHANGES, draft),
      ...archived.filter((d) => d.endsWith(`-${draft}`)).map((d) => path.join(archive, d)),
    ];
    const capabilities = new Set([module]);
    const specs: string[] = [];
    for (const dir of changeDirs) {
      for (const cap of dirs(path.join(dir, "specs"))) {
        capabilities.add(cap);
        specs.push(read(path.join(dir, "specs", cap, "spec.md")));
      }
    }
    for (const cap of capabilities)
      specs.push(read(path.join(projectDir, CAPABILITIES, cap, "spec.md")));
    for (const spec of specs) {
      for (const id of declared(spec)) {
        if (!places.has(id)) places.set(id, { module, rank, of: modules.length });
      }
    }
  });
  return places;
}

/**
 * `items` in build order: the brief's modules in its order, each module's
 * requirements in the order they had. A requirement outside every module keeps
 * its side: before the modules when it came before them (spec.md's own, the
 * project's foundation), after them otherwise. Stable.
 */
export function inBuildOrder<T extends { requirement: string }>(
  items: readonly T[],
  places: Map<string, ModulePlace>
): T[] {
  if (places.size === 0) return [...items];
  const first = items.findIndex((it) => places.has(it.requirement));
  if (first === -1) return [...items];
  const rank = (it: T, i: number) =>
    places.get(it.requirement)?.rank ?? (i < first ? -1 : Number.MAX_SAFE_INTEGER);
  return items
    .map((it, i) => ({ it, i, r: rank(it, i) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.it);
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${s}`;
}

/** Why this requirement comes next, in words: "bookings, the brief's 1st module of 3". */
export function whyNext(place: ModulePlace | undefined): string | null {
  if (!place) return null;
  return `${place.module}, the brief's ${ordinal(place.rank + 1)} module of ${place.of}`;
}
