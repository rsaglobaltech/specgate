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
import {
  classDiagram,
  sequenceDiagram,
  type ScenarioSteps,
} from "../../packages/core/src/domain/EvidenceDiagrams";

export interface RequirementDiagrams {
  /** The commit the before is read from; empty when there is none. */
  base: string;
  sequences: Array<{ scenario: string; before: string | null; after: string | null }>;
  classes: Array<{ file: string; before: string | null; after: string }>;
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

export function requirementDiagrams(dir: string, id: string, base = ""): RequirementDiagrams {
  const commit = baseOf(dir, base);
  const { now, atBase } = sections(dir, id, commit);
  const keys = [
    ...new Set([...(now?.scenarios || []), ...(atBase?.scenarios || [])].map((s) => s.key)),
  ];
  const draw = (s: Section | null, key: string) => {
    const sc = s?.scenarios.find((x) => x.key === key);
    return sc ? sequenceDiagram(sc, s!.actor) : null;
  };
  const sequences = keys.map((key) => ({
    scenario: (now?.scenarios.find((s) => s.key === key) ||
      atBase?.scenarios.find((s) => s.key === key))!.title,
    before: draw(atBase, key),
    after: draw(now, key),
  }));
  const classes = codeFiles(dir, id, now?.artifact || "").flatMap((file) => {
    let source: string;
    try {
      source = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      return [];
    }
    const before = commit ? git(dir, ["show", `${commit}:./${file}`]) : null;
    const after = classDiagram(file, before, source);
    return after.trim() === "classDiagram"
      ? []
      : [{ file, before: before === null ? null : classDiagram(file, null, before, false), after }];
  });
  return { base: commit, sequences, classes };
}
