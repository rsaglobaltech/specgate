/**
 * The domain documents generated from a project's sources, and what
 * `validate` says about them (REQ-538 … REQ-541).
 *
 * The rules are pure, in `packages/core/src/domain`; this module reads the
 * files they need and writes the two generated ones.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { TermCandidate } from "../../packages/core/src/domain/Glossary";
import { frontMatter } from "../draft/brief-setup";
import { ACTOR_NAME, actorName } from "../../packages/core/src/domain/DraftChecklist";
import { readDerivationSources } from "../../packages/core/src/infrastructure/DerivedMatrixSources";
import { parseTraceabilityRows } from "../../packages/core/src/domain/TraceabilityFormat";
import {
  ACTORS_FILE,
  AGGREGATES_FILE,
  MODEL_FILE,
  MODEL_SOURCE,
  aggregatesIn,
  mergeEntities,
  modelSourceEntities,
  renderActors,
  renderModel,
  type ActorRequirement,
} from "../../packages/core/src/domain/DomainDiagrams";
import {
  GLOSSARY_FILE,
  forbiddenWords,
  parseGlossary,
  suggestTerms,
  withTerms,
} from "../../packages/core/src/domain/Glossary";
import {
  duplicateRules,
  rulesIn,
  untestedRules,
  type RequirementRules,
} from "../../packages/core/src/domain/BusinessRules";
import { error, warning, type Diagnostic } from "./diagnostics";

const read = (dir: string, rel: string): string | null => {
  try {
    return fs.readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return null;
  }
};

/** Every spec file a requirement can live in: spec.md, the capability specs, the open deltas. */
function specFiles(dir: string): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const spec = read(dir, "spec.md");
  if (spec !== null) out.push({ file: "spec.md", text: spec });
  const walk = (rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== "archive") walk(child);
      } else if (e.name === "spec.md") {
        const text = read(dir, child);
        if (text !== null) out.push({ file: child, text });
      }
    }
  };
  walk("docs/specs/capabilities");
  walk("docs/specs/changes");
  return out;
}

// ── REQ-538 ─────────────────────────────────────────────────────────────────

/** `glossary_term_forbidden` for every avoided word a requirement or scenario uses. */
export function glossaryFindings(dir: string, strict: boolean): Diagnostic[] {
  const md = read(dir, GLOSSARY_FILE);
  if (md === null) return [];
  const glossary = parseGlossary(md);
  if (!glossary.some((g) => g.avoid.length > 0)) return [];
  const sources = [...specFiles(dir)];
  const features: string[] = [];
  const walk = (rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith(".feature")) features.push(child);
    }
  };
  walk("features");
  for (const f of features.sort()) {
    const text = read(dir, f);
    if (text !== null) sources.push({ file: f, text });
  }
  const make = strict ? error : warning;
  return sources.flatMap(({ file, text }) =>
    forbiddenWords(text, glossary).map((w) =>
      make(
        "glossary_term_forbidden",
        `${file}:${w.line} says "${w.word}" — the glossary's term is ${w.term}.`,
        {
          file,
          line: w.line,
          target: w.word,
          fix: `Write ${w.term} instead, or take "${w.word.toLowerCase()}" off its Avoid column in ${GLOSSARY_FILE}.`,
        }
      )
    )
  );
}

// ── REQ-539 ─────────────────────────────────────────────────────────────────

const DELIVERED = new Set(["Implemented", "Verified", "Released"]);

/** Every requirement's numbered rules. */
export function projectRules(dir: string): RequirementRules[] {
  return specFiles(dir).flatMap(({ file, text }) => rulesIn(file, text));
}

/** `rule_duplicate` always; `rule_untested` for a delivered requirement's rule, with --strict. */
export function ruleFindings(dir: string, strict: boolean): Diagnostic[] {
  const all = projectRules(dir);
  if (all.length === 0) return [];
  const out: Diagnostic[] = duplicateRules(all).map((r) =>
    error(
      "rule_duplicate",
      `${r.id} is used twice — again by ${r.requirement} in ${r.file}:${r.line}.`,
      {
        file: r.file,
        line: r.line,
        target: r.id,
        fix: "Rule ids are unique across the specification: give this one the next free BR number.",
      }
    )
  );
  if (!strict) return out;
  // A requirement is delivered by its trace, or, in a hand-kept matrix, by its row.
  const rowStatus = new Map<string, string>();
  try {
    for (const row of parseTraceabilityRows(read(dir, "docs/specs/traceability.md") || "").rows ||
      []) {
      const id = String((row as { requirement?: string }).requirement || "").trim();
      const status = String((row as { status?: string }).status || "").trim();
      if (id) rowStatus.set(id, status);
    }
  } catch {
    // No readable matrix: the traces decide.
  }
  const tests = readDerivationSources(dir).tests.map((t) => t.source);
  const delivered = (req: string, trace: string) =>
    DELIVERED.has(trace) || DELIVERED.has(rowStatus.get(req) || "");
  for (const r of untestedRules(all, tests, delivered)) {
    out.push(
      error("rule_untested", `${r.id} of ${r.requirement} is delivered, and no test mentions it.`, {
        file: r.file,
        line: r.line,
        target: r.id,
        fix: `Write a test that exercises ${r.id} and names it, e.g. in its title: "${r.requirement} ${r.id}: …".`,
      })
    );
  }
  return out;
}

// ── REQ-540, REQ-541 ────────────────────────────────────────────────────────

/** What `docs/specs/model.md` should hold; null when there is nothing to draw. */
export function generatedModel(dir: string): string | null {
  return renderModel(
    mergeEntities(
      aggregatesIn(read(dir, AGGREGATES_FILE)),
      modelSourceEntities(read(dir, MODEL_SOURCE))
    )
  );
}

/** The actors `docs/brief.md` declares, as written. */
export function briefActors(dir: string): string[] {
  const brief = read(dir, "docs/brief.md") ?? read(dir, "brief.md");
  const fm = brief ? frontMatter(brief) : null;
  if (!fm) return [];
  const names = new Set<string>();
  for (const m of fm.matchAll(new RegExp(String.raw`\{\s*name:\s*${ACTOR_NAME}\s*[,}]`, "g")))
    names.add(actorName(m[1]));
  const bare = /^actors:\s*\[([^\]{]*)\]\s*$/m.exec(fm);
  if (bare) for (const a of bare[1].split(",")) if (a.trim()) names.add(a.trim());
  return [...names].filter((n) => !/<[^>]+>/.test(n));
}

/** Every requirement with an `actor=` in its trace, with its capability. */
function actorRequirements(dir: string): ActorRequirement[] {
  const out: ActorRequirement[] = [];
  for (const { file, text } of specFiles(dir)) {
    if (file.startsWith("docs/specs/changes/")) continue;
    const capability = file === "spec.md" ? "spec" : file.split("/")[3] || "spec";
    let current: { id: string; title: string } | null = null;
    for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
      const h = /^#{2,4}\s+(?:Requirement:\s+)?(REQ-\d+)\s*(?:[—:-]\s*(.*))?$/.exec(line);
      if (h) {
        current = { id: h[1], title: (h[2] || "").trim() };
        continue;
      }
      const a =
        current && line.includes("specgate:trace")
          ? /\bactor=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/.exec(line)
          : null;
      if (current && a) {
        out.push({ ...current, capability, actor: (a[1] ?? a[2] ?? a[3] ?? "").trim() });
        current = null;
      }
    }
  }
  return out;
}

/** REQ-595: the names the project already uses — its actors and its domain model's entities. */
export function glossaryCandidates(dir: string): TermCandidate[] {
  return [
    ...(briefActors(dir).length > 0 ? briefActors(dir) : requirementActors(dir)).map((term) => ({
      term,
      from: "actor" as const,
    })),
    ...mergeEntities(
      aggregatesIn(read(dir, AGGREGATES_FILE)),
      modelSourceEntities(read(dir, MODEL_SOURCE))
    ).map((e) => ({ term: e.name, from: "entity" as const })),
  ];
}

/**
 * The actors to draw (REQ-594): the brief's, as it spells them; with no brief,
 * or a brief that names none, the ones the requirements' \`actor=\` name — a
 * project adopted from its code has requirements long before it has a brief —
 * when the project has the diagram already.
 */
export function projectActors(dir: string): string[] {
  const declared = briefActors(dir);
  if (declared.length > 0) return declared;
  // Only where the project keeps the diagram: a check never adds a file a
  // project did not have.
  if (!fs.existsSync(path.join(dir, ACTORS_FILE))) return [];
  return requirementActors(dir);
}

/** The actors the delivered requirements' \`actor=\` name, each once, ignoring case. */
export function requirementActors(dir: string): string[] {
  const seen = new Map<string, string>();
  for (const r of actorRequirements(dir)) {
    const key = r.actor.toLowerCase();
    if (r.actor && !/<[^>]+>/.test(r.actor) && !seen.has(key)) seen.set(key, r.actor);
  }
  return [...seen.values()];
}

/** What `docs/specs/actors.md` should hold; null when no actor is named anywhere. */
export function generatedActors(dir: string): string | null {
  return renderActors(projectActors(dir), actorRequirements(dir));
}

/**
 * REQ-594: why \`docs/specs/actors.md\` is not drawn, when it is not — said once
 * by \`check\`, instead of a file that stays as \`init\` wrote it without a word.
 */
export function actorsNotDrawn(dir: string): string | null {
  if (generatedActors(dir) !== null) return null;
  if (!fs.existsSync(path.join(dir, ACTORS_FILE))) return null;
  return (
    `${ACTORS_FILE} is not drawn: neither docs/brief.md (actors:) nor any delivered ` +
    "requirement (actor= in its specgate:trace) names an actor"
  );
}

/** `actor_unknown` for a requirement whose actor the brief does not list. Warnings. */
export function actorFindings(dir: string): Diagnostic[] {
  const actors = briefActors(dir);
  if (actors.length === 0) return [];
  const known = new Set(actors.map((a) => a.toLowerCase()));
  return actorRequirements(dir)
    .filter((r) => r.actor && !known.has(r.actor.toLowerCase()))
    .map((r) =>
      warning("actor_unknown", `${r.id}'s actor ${r.actor} is not among the brief's actors.`, {
        target: r.id,
        fix: `Use one of ${actors.join(", ")} in its actor=, or add ${r.actor} to actors: in docs/brief.md.`,
      })
    );
}

/** `model_stale` / `actors_stale` for a committed copy that differs from its sources. */
export function staleDiagramFindings(dir: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const check = (file: string, expected: string | null, code: string) => {
    const committed = read(dir, file);
    if (committed === null || expected === null) return;
    if (committed.replace(/\r\n/g, "\n") === expected) return;
    out.push(
      error(code, `${file} differs from what its sources generate.`, {
        file,
        fix: "Run `specgate check` (it regenerates the file), or delete it — never edit it by hand.",
      })
    );
  };
  check(MODEL_FILE, generatedModel(dir), "model_stale");
  check(ACTORS_FILE, generatedActors(dir), "actors_stale");
  return out;
}

/** Regenerate both diagrams from their sources; the files written. */
export function refreshDomainDiagrams(dir: string): string[] {
  const written: string[] = [];
  for (const [file, next] of [
    [MODEL_FILE, generatedModel(dir)],
    [ACTORS_FILE, generatedActors(dir)],
  ] as const) {
    if (next === null) continue;
    if (read(dir, file) === next) continue;
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), next, "utf8");
    written.push(file);
  }
  return written;
}

/**
 * REQ-595: the names the project uses — its actors, its domain model's
 * entities — that its glossary does not define yet. Only where the project
 * keeps a glossary: nothing adds a file a project did not have.
 */
export function glossaryMissing(dir: string): string[] {
  const md = read(dir, GLOSSARY_FILE);
  if (md === null) return [];
  return suggestTerms(parseGlossary(md), glossaryCandidates(dir)).map((s) => s.term);
}

/**
 * REQ-595: `archive` adds each missing name as a row of the glossary, its
 * Definition and Avoid left for the team to write. The terms added.
 */
export function addGlossaryTerms(dir: string): string[] {
  const missing = glossaryMissing(dir);
  if (missing.length === 0) return [];
  const md = read(dir, GLOSSARY_FILE) as string;
  fs.writeFileSync(path.join(dir, GLOSSARY_FILE), withTerms(md, missing), "utf8");
  return missing;
}
