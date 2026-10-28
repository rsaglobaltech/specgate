/**
 * The two measures Specgate computes itself (ADR-0040 point 4): how much of
 * the code a change touched its tests run, and how many of the mutants on
 * those lines its tests kill. Read from the reports the project's tools
 * already write — JaCoCo XML, LCOV, Cobertura; PIT `mutations.xml`, StrykerJS
 * `mutation.json` — so no tool is bundled. Pure: the caller hands texts in.
 */

/** Lines added or changed per file, from `git diff --unified=0`. */
export function changedLines(diff: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  let file = "";
  for (const line of diff.split(/\r?\n/)) {
    const to = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
    if (to) {
      file = to[1] === "/dev/null" ? "" : to[1].trim();
      if (file && !out.has(file)) out.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = 0; i < count; i += 1) out.get(file)!.add(start + i);
    }
  }
  return out;
}

export interface LineCoverage {
  /** Lines the tool counts as executable. */
  executable: Set<number>;
  covered: Set<number>;
}

/** An attribute's value, in double or single quotes: PIT writes `status='KILLED'`. */
const attr = (tag: string, name: string) =>
  (new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag) || [])
    .slice(1)
    .find((v) => v !== undefined);

/** JaCoCo XML: `package/SourceFile.java` → its lines. */
export function readJacoco(xml: string): Map<string, LineCoverage> {
  const out = new Map<string, LineCoverage>();
  const pkgRe = /<package\b([^>]*)>([\s\S]*?)<\/package>/g;
  for (const pkg of xml.matchAll(pkgRe)) {
    const pkgName = attr(pkg[1], "name") || "";
    for (const src of pkg[2].matchAll(/<sourcefile\b([^>]*)>([\s\S]*?)<\/sourcefile>/g)) {
      const key = `${pkgName ? `${pkgName}/` : ""}${attr(src[1], "name")}`;
      const cov: LineCoverage = { executable: new Set(), covered: new Set() };
      for (const l of src[2].matchAll(/<line\b([^>]*)\/?>/g)) {
        const nr = Number(attr(l[1], "nr"));
        const mi = Number(attr(l[1], "mi") || 0);
        const ci = Number(attr(l[1], "ci") || 0);
        if (mi + ci > 0) cov.executable.add(nr);
        if (ci > 0) cov.covered.add(nr);
      }
      out.set(key, cov);
    }
  }
  return out;
}

/** LCOV: `SF:` path → its `DA:line,hits`. */
export function readLcov(text: string): Map<string, LineCoverage> {
  const out = new Map<string, LineCoverage>();
  let cur: LineCoverage | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      cur = { executable: new Set(), covered: new Set() };
      out.set(line.slice(3).trim().replace(/\\/g, "/"), cur);
    } else if (cur && line.startsWith("DA:")) {
      const [nr, hits] = line.slice(3).split(",").map(Number);
      cur.executable.add(nr);
      if (hits > 0) cur.covered.add(nr);
    } else if (line.startsWith("end_of_record")) cur = null;
  }
  return out;
}

/** Cobertura: `<class filename>` → its `<line number hits>`. */
export function readCobertura(xml: string): Map<string, LineCoverage> {
  const out = new Map<string, LineCoverage>();
  for (const cls of xml.matchAll(/<class\b([^>]*)>([\s\S]*?)<\/class>/g)) {
    const file = (attr(cls[1], "filename") || "").replace(/\\/g, "/");
    const cov = out.get(file) || { executable: new Set<number>(), covered: new Set<number>() };
    for (const l of cls[2].matchAll(/<line\b([^>]*)\/?>/g)) {
      const nr = Number(attr(l[1], "number"));
      cov.executable.add(nr);
      if (Number(attr(l[1], "hits") || 0) > 0) cov.covered.add(nr);
    }
    out.set(file, cov);
  }
  return out;
}

/** The report's entry for a repository file: the same path, or one ending the other. */
function entryFor<T>(map: Map<string, T>, file: string): T | undefined {
  const f = file.replace(/\\/g, "/");
  if (map.has(f)) return map.get(f);
  for (const [k, v] of map) {
    const key = k.replace(/\\/g, "/").replace(/^\.\//, "");
    if (f.endsWith(`/${key}`) || key.endsWith(`/${f}`) || key === f) return v;
  }
  return undefined;
}

export interface Measure {
  /** The percentage, or null when the change has nothing to measure. */
  value: number | null;
  total: number;
  passed: number;
  /** What lowers it: uncovered lines, or surviving mutants, as `path:line …`. */
  misses: string[];
}

const pct = (passed: number, total: number) =>
  total === 0 ? null : Math.round((passed / total) * 1000) / 10;

/** Coverage of the executable lines a change touched. */
export function diffCoverage(
  changed: Map<string, Set<number>>,
  report: Map<string, LineCoverage>
): Measure {
  let total = 0;
  let passed = 0;
  const misses: string[] = [];
  for (const [file, lines] of changed) {
    const cov = entryFor(report, file);
    if (!cov) continue;
    for (const n of [...lines].sort((a, b) => a - b)) {
      if (!cov.executable.has(n)) continue;
      total += 1;
      if (cov.covered.has(n)) passed += 1;
      else misses.push(`${file}:${n} not run by any test`);
    }
  }
  return { value: pct(passed, total), total, passed, misses };
}

export interface Mutant {
  /** As the report names the file: a path, or `package/Class.java`. */
  file: string;
  line: number;
  killed: boolean;
  /** Not counted either way: ignored, failed to compile, crashed. */
  excluded: boolean;
  mutator: string;
  description: string;
}

/** PIT `mutations.xml`: KILLED and TIMED_OUT count as killed. */
export function readPit(xml: string): Mutant[] {
  const out: Mutant[] = [];
  for (const m of xml.matchAll(/<mutation\b([^>]*)>([\s\S]*?)<\/mutation>/g)) {
    const tag = (name: string) =>
      ((new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(m[2]) || [])[1] || "").trim();
    const status = attr(m[1], "status") || "";
    const cls = tag("mutatedClass").replace(/\$.*$/, "");
    const source = tag("sourceFile");
    const pkg = cls.includes(".") ? cls.slice(0, cls.lastIndexOf(".")).replace(/\./g, "/") : "";
    out.push({
      file: `${pkg ? `${pkg}/` : ""}${source}`,
      line: Number(tag("lineNumber")),
      killed: status === "KILLED" || status === "TIMED_OUT",
      excluded: status === "NON_VIABLE" || status === "RUN_ERROR",
      mutator: tag("mutator").split(".").pop() || "",
      description: tag("description"),
    });
  }
  return out;
}

/** StrykerJS `mutation.json` (mutation-testing-elements schema). */
export function readStryker(text: string): Mutant[] {
  const doc = JSON.parse(text) as {
    files?: Record<
      string,
      {
        mutants?: Array<{
          status?: string;
          mutatorName?: string;
          replacement?: string;
          location?: { start?: { line?: number } };
        }>;
      }
    >;
  };
  const out: Mutant[] = [];
  for (const [file, f] of Object.entries(doc.files || {})) {
    for (const m of f.mutants || []) {
      const status = String(m.status || "");
      out.push({
        file: file.replace(/\\/g, "/"),
        line: Number(m.location?.start?.line) || 0,
        killed: status === "Killed" || status === "Timeout",
        excluded: ["Ignored", "CompileError", "RuntimeError", "Pending"].includes(status),
        mutator: String(m.mutatorName || ""),
        description: m.replacement ? `replaced with ${m.replacement}` : "",
      });
    }
  }
  return out;
}

/** The mutation score over the mutants on lines a change touched. */
export function mutationScore(changed: Map<string, Set<number>>, mutants: Mutant[]): Measure {
  let total = 0;
  let passed = 0;
  const misses: string[] = [];
  const byFile = new Map<string, Mutant[]>();
  for (const m of mutants) byFile.set(m.file, [...(byFile.get(m.file) || []), m]);
  for (const [file, lines] of changed) {
    const list = entryFor(byFile, file) || [];
    for (const m of list) {
      if (m.excluded || !lines.has(m.line)) continue;
      total += 1;
      if (m.killed) passed += 1;
      else
        misses.push(
          `${file}:${m.line} ${m.mutator} survived${m.description ? ` — ${m.description}` : ""}`
        );
    }
  }
  return { value: pct(passed, total), total, passed, misses };
}
