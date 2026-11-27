/**
 * A requirement's diagrams at the base and now (ADR-0047, REQ-806): its
 * scenarios from the spec, wherever it lives — spec.md, a capability, an open
 * change's delta — and its code from the files the matrix links to it. The
 * base is the one `check --affected` measures from.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { baseOf } from "./quality-run";
import { escapeRegExp } from "./escape";
import { parseTraceComment } from "../../packages/core/src/domain/SpecParser";
import { deriveRows } from "../../packages/core/src/domain/DerivedMatrix";
import { readDerivationSources } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import { sequenceDiagram, type ScenarioSteps } from "../../packages/core/src/domain/EvidenceDiagrams";
import { umlTypesOf, typeNames, type UmlType } from "../../packages/core/src/domain/UmlModel";
import {
  codeSequence,
  memberLines,
  UML_THEME,
  umlClassDiagram,
  webCallsOf,
} from "../../packages/core/src/domain/UmlDiagrams";

export interface RequirementDiagrams {
  /** The commit the before is read from; empty when there is none. */
  base: string;
  sequences: Array<{ scenario: string; before: string | null; after: string | null }>;
  /** One UML class diagram per language: the slice of the code the requirement touches. */
  classes: Array<{ file: string; before: string | null; after: string; legend: string }>;
}

interface Section {
  actor: string;
  artifact: string;
  scenarios: Array<ScenarioSteps & { key: string }>;
}

/** The requirement's section in one spec's text, or null. */
function sectionOf(text: string, id: string): Section | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const heading = new RegExp(`^(#{2,4})\\s+(?:Requirement:\\s*)?${escapeRegExp(id)}\\b`);
  const at = lines.findIndex((l) => heading.test(l.trim()));
  if (at < 0) return null;
  const level = (heading.exec(lines[at].trim()) as RegExpExecArray)[1].length;
  let actor = "";
  let artifact = "";
  const scenarios: Section["scenarios"] = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const h = /^(#{1,6})\s/.exec(line);
    if (h && h[1].length <= level) break;
    if (/specgate:trace\b/.test(line)) {
      const t = parseTraceComment(line);
      actor = actor || t.actor || "";
      artifact = artifact || t.artifact || "";
      continue;
    }
    const s = /^#{3,6}\s+Scenario:\s*(?:(SCN-[\w.]+)\s*[—–-]\s*)?(.+)$/.exec(line.trim());
    if (s) {
      scenarios.push({ key: s[1] || s[2].trim(), title: s[2].trim(), steps: [] });
      continue;
    }
    const step = /^\s*(?:[-*]\s+)?((?:GIVEN|WHEN|THEN|AND|BUT)\b.*)$/i.exec(line);
    if (step && scenarios.length) (scenarios[scenarios.length - 1].steps as string[]).push(step[1]);
  }
  return { actor, artifact, scenarios };
}

const SPEC_FILE =
  /^(spec\.md|docs\/specs\/(capabilities\/[^/]+|changes\/(?!archive\/)[^/]+\/specs\/[^/]+)\/spec\.md)$/;

function git(dir: string, args: string[]): string | null {
  const r = spawnSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return r.status === 0 ? r.stdout : null;
}

function walkSpecs(dir: string): string[] {
  const out: string[] = [];
  const visit = (rel: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory() && e.name !== "archive") visit(child);
      else if (SPEC_FILE.test(child)) out.push(child);
    }
  };
  if (fs.existsSync(path.join(dir, "spec.md"))) out.push("spec.md");
  visit("docs/specs");
  return out.sort();
}

/** The requirement's section now, and at the base (read from git), each from the first spec that holds it. */
function sections(dir: string, id: string, base: string) {
  const find = (files: string[], read: (f: string) => string | null) => {
    for (const f of files) {
      const text = read(f);
      const s = text === null ? null : sectionOf(text, id);
      if (s) return s;
    }
    return null;
  };
  const now = find(walkSpecs(dir), (f) => {
    try {
      return fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      return null;
    }
  });
  const atBase = base
    ? find(
        (git(dir, ["ls-tree", "-r", "--name-only", base, "--", "spec.md", "docs/specs"]) || "")
          .split("\n")
          .filter((f) => SPEC_FILE.test(f))
          .sort(),
        (f) => git(dir, ["show", `${base}:./${f}`])
      )
    : null;
  return { now, atBase };
}

/**
 * The files the requirement's code column names. A requirement still in an
 * open change's delta has no matrix row yet: its code is the source files
 * that name it, by the matrix's own rule.
 */
function codeFiles(dir: string, id: string, stated: string): string[] {
  const sources = stated ? null : readDerivationSources(dir);
  const fromRows = sources
    ? deriveRows(sources)
        .filter((r) => r.requirement === id)
        .map((r) => r.technicalArtifact || "")
        .join(",")
        .replace(/[`\s]|TBD|^-$/g, "")
    : "";
  const names = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(id)}(?![A-Za-z0-9])`);
  const listed =
    stated ||
    fromRows ||
    (sources?.code || [])
      .filter((f) => names.test(f.source))
      .map((f) => f.path)
      .join(",");
  return [
    ...new Set(
      listed
        .replace(/`/g, "")
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f && f !== "-" && f.toUpperCase() !== "TBD")
    ),
  ].sort();
}

// ── The code, as UML (REQ-811, REQ-812) ──────────────────────────────────────

const LANGUAGES: Array<{ name: string; test: RegExp }> = [
  { name: "Java", test: /\.java$/i },
  { name: "TypeScript", test: /\.(ts|tsx|mts|cts)$/i },
  { name: "JavaScript", test: /\.(js|jsx|mjs|cjs)$/i },
  { name: "Kotlin", test: /\.(kt|kts)$/i },
  { name: "C#", test: /\.cs$/i },
  { name: "Python", test: /\.py$/i },
];
const languageOf = (file: string) => LANGUAGES.find((l) => l.test.test(file))?.name || "";

/** Folders whose files are not the product's code. */
const SKIP_DIR = /^(?:node_modules|\.git|dist|build|target|out|coverage|\.next|\.features-gen|\.specgate|test-results|vendor|__pycache__)$/;
/** Test sources: not part of the slice a reviewer reads as the design. */
const TEST_FILE = /(?:^|\/)(?:src\/test|tests?|__tests__|e2e|spec)\/|\.(?:test|spec)\.[^/]+$|Tests?\.(?:java|kt|cs)$/;
const MAX_INDEX = 2000;
const MAX_SLICE = 16;

/** The project's source files in the languages given, tests left out, sorted. */
function sourceFiles(dir: string, languages: Set<string>): string[] {
  const out: string[] = [];
  const visit = (rel: string) => {
    if (out.length >= MAX_INDEX) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIR.test(e.name)) visit(child);
      } else if (languages.has(languageOf(child)) && !TEST_FILE.test(child)) out.push(child);
    }
  };
  visit("");
  return out;
}

interface Indexed {
  types: UmlType[];
  /** The files read, with their text. */
  sources: Map<string, string>;
}

function indexOf(files: string[], read: (f: string) => string | null): Indexed {
  const types: UmlType[] = [];
  const sources = new Map<string, string>();
  for (const f of files) {
    const text = read(f);
    if (text === null) continue;
    sources.set(f, text);
    types.push(...umlTypesOf(f, text));
  }
  return { types, sources };
}

/**
 * The slice a requirement touches: the types of its own files, what they
 * reference (two steps out), the implementations of the interfaces drawn, and
 * the types that hold one of its own as an attribute.
 */
function sliceOf(index: UmlType[], seeds: UmlType[]): UmlType[] {
  const byName = new Map<string, UmlType>();
  for (const t of index) if (!byName.has(t.name)) byName.set(t.name, t);
  const chosen = new Map<string, UmlType>();
  const add = (t: UmlType | undefined) => {
    if (t && !chosen.has(t.name) && chosen.size < MAX_SLICE) chosen.set(t.name, t);
  };
  seeds.forEach(add);
  const refs = (t: UmlType) =>
    [
      ...t.parents.map((p) => p.name),
      ...t.members.flatMap((m) => [m.type, ...m.params.map((p) => p.type)]).flatMap(typeNames),
    ].filter((n) => n !== t.name);
  let frontier = [...chosen.values()];
  for (let step = 0; step < 2; step += 1) {
    const next: UmlType[] = [];
    for (const t of frontier) {
      for (const n of refs(t)) {
        const r = byName.get(n);
        if (r && !chosen.has(r.name)) {
          add(r);
          next.push(r);
        }
      }
    }
    frontier = next;
  }
  for (const t of [...chosen.values()].filter((x) => x.kind === "interface")) {
    index.filter((x) => x.parents.some((p) => p.name === t.name)).forEach(add);
  }
  const seedNames = new Set(seeds.map((s) => s.name));
  const holders = index.filter((t) =>
    t.members.some((m) => m.kind === "field" && typeNames(m.type).some((n) => seedNames.has(n)))
  );
  holders.forEach(add);
  // What a holder's own operations take and give: an endpoint's request and response.
  for (const t of holders) for (const n of refs(t)) add(byName.get(n));
  // In the order the project declares them: the same input, the same text.
  return index.filter((t) => chosen.get(t.name) === t);
}

/** The package every one of them is in: .b.c and .b.d → .b. */
function commonPackage(pkgs: string[]): string {
  const parts = pkgs.map((p) => p.split("."));
  const out: string[] = [];
  for (let i = 0; parts.every((p) => i < p.length && p[i] === parts[0][i]); i += 1) out.push(parts[0][i]);
  return out.join(".");
}

function sliceDiagrams(id: string, dir: string, seedFiles: string[], nowTypes: UmlType[], baseTypes: UmlType[] | null) {
  const languages = new Set(seedFiles.map(languageOf).filter(Boolean));
  const now = { types: nowTypes };
  const atBase = baseTypes ? { types: baseTypes } : null;
  const classes: RequirementDiagrams["classes"] = [];
  for (const language of [...languages].sort()) {
    const inLanguage = (t: UmlType) => languageOf(t.file) === language;
    const seeds = now.types.filter((t) => inLanguage(t) && seedFiles.includes(t.file));
    if (seeds.length === 0) continue;
    const slice = sliceOf(now.types.filter(inLanguage), seeds);
    const baseByName = new Map((atBase?.types || []).filter(inLanguage).map((t) => [t.name, t]));
    const added = new Set<string>();
    const changed = new Map<string, { added: string[]; removed: string[] }>();
    for (const t of slice) {
      const was = baseByName.get(t.name);
      if (!was) {
        if (atBase) added.add(t.name);
        continue;
      }
      const a = memberLines(t);
      const b = memberLines(was);
      const plus = a.filter((x) => !b.includes(x));
      const minus = b.filter((x) => !a.includes(x));
      if (plus.length || minus.length) changed.set(t.name, { added: plus, removed: minus });
    }
    const baseSlice = slice.map((t) => baseByName.get(t.name)).filter((t): t is UmlType => !!t);
    const pkgs = slice.map((t) => t.pkg).filter(Boolean);
    const roots = pkgs.length ? [commonPackage(pkgs)].filter(Boolean) : [];
    const legend = [
      added.size ? `New since the base: ${[...added].map((n) => `\`${n}\``).join(", ")}.` : "",
      ...[...changed].map(
        ([n, c]) =>
          `Changed: \`${n}\`${c.added.length ? ` — added ${c.added.map((x) => `\`${x}\``).join(", ")}` : ""}${
            c.removed.length ? ` — removed ${c.removed.map((x) => `\`${x}\``).join(", ")}` : ""
          }.`
      ),
    ]
      .filter(Boolean)
      .join(" ");
    classes.push({
      file: `${language}${roots.length ? ` — ${roots.join(", ")}` : ""}`,
      after: umlClassDiagram(slice, { added, changed }),
      before: atBase && baseSlice.length ? umlClassDiagram(baseSlice) : null,
      legend,
    });
  }
  const webCalls = seedFiles
    .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/i.test(f))
    .flatMap((f) => {
      try {
        return webCallsOf(fs.readFileSync(path.join(dir, f), "utf8"), id);
      } catch {
        return [];
      }
    });
  return { classes, webCalls };
}

/** Every source file of the languages the requirement's code is written in, Java as the backend's. */
function backendTypes(dir: string, seedFiles: string[], commit: string) {
  const languages = new Set(["Java", ...seedFiles.map(languageOf).filter(Boolean)]);
  const files = sourceFiles(dir, languages);
  const now = indexOf(files, (f) => {
    try {
      return fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      return null;
    }
  }).types;
  const base = commit
    ? indexOf(
        (git(dir, ["ls-tree", "-r", "--name-only", commit]) || "")
          .split("\n")
          .filter((f) => languages.has(languageOf(f)) && !TEST_FILE.test(f)),
        (f) => git(dir, ["show", `${commit}:./${f}`])
      ).types
    : null;
  return { now, base };
}

export function requirementDiagrams(dir: string, id: string, base = ""): RequirementDiagrams {
  const commit = baseOf(dir, base);
  const { now, atBase } = sections(dir, id, commit);
  const seedFiles = codeFiles(dir, id, now?.artifact || "");
  const code = backendTypes(dir, seedFiles, commit);
  const slice = sliceDiagrams(id, dir, seedFiles, code.now, code.base);
  const keys = [
    ...new Set([...(now?.scenarios || []), ...(atBase?.scenarios || [])].map((s) => s.key)),
  ];
  // The scenario followed through the code when its call reaches an endpoint; the spec's words when not.
  const draw = (s: Section | null, key: string, types: UmlType[] | null) => {
    const sc = s?.scenarios.find((x) => x.key === key);
    if (!sc) return null;
    const traced = types
      ? codeSequence({ scenario: sc, actor: s!.actor, types, webCalls: slice.webCalls })
      : null;
    return traced || `${UML_THEME}\n${sequenceDiagram(sc, s!.actor)}`;
  };
  const sequences = keys.map((key) => ({
    scenario: (now?.scenarios.find((s) => s.key === key) ||
      atBase?.scenarios.find((s) => s.key === key))!.title,
    before: draw(atBase, key, code.base),
    after: draw(now, key, code.now),
  }));
  return { base: commit, sequences, classes: slice.classes };
}
