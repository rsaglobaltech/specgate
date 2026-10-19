/**
 * A pack version bump, expressed as intent.
 *
 * The plain `specops diff` answers "which files would change?". That is the
 * wrong question at review time: `~ docs/specs/traceability.md` tells a
 * reviewer nothing about what the domain now requires. This module answers
 * "which requirements would change?", so a pack upgrade is reviewed the same
 * way any other change is — proposal plus delta specs.
 *
 * **Derivation is from the requirements AST, never from a textual file diff.**
 * A pack that only reformats a template, bumps its own version string or
 * rewords a comment produces zero deltas. That is the whole point: if the
 * output were derived from rendered files, every cosmetic change upstream
 * would manufacture noise and the feature would be worse than the file diff
 * it replaces.
 *
 * Pure throughout. Loading a pack, reading a scenario's steps out of its
 * Gherkin template, and resolving the project's phrase table are the caller's
 * to supply — `scripts/specops/as_change` wires all three to the real disk.
 */

import { PackItem, asArray } from "./PackSpec";
import { PackEntry } from "./Lockfile";
import { PackModel } from "./YamlLite";
import { Phrases } from "./Language";

/** A loaded pack: its model, and the directory its templates resolve against. */
export interface LoadedPack {
  model: PackModel;
  packDir: string;
}

/**
 * The Gherkin steps for one scenario, or null when there are none to be had.
 * Supplied by the caller so this module never opens a template file itself.
 */
export type ReadSteps = (packDir: string, scenario: PackItem) => string[] | null;

/** A requirement the delta can name: one whose `id` was present. */
export type IdentifiedPackItem = PackItem & { id: string };

/** The requirement ids a pack bump adds, changes and retires. */
export interface PackDeltaSummary {
  added: string[];
  modified: string[];
  removed: string[];
}

/** What `derivePackDelta` found. `markdown` is null when nothing behavioural changed. */
export interface DerivedPackDelta {
  capability: string;
  markdown: string | null;
  summary: PackDeltaSummary;
}

/** How one requirement block renders inside the delta. */
export interface RequirementBlockOptions {
  /** A retired requirement: heading and reason, no scenarios. */
  bodyless?: boolean;
  reason?: string;
  /** Where the requirement came from, written into the trace comment. */
  origin?: string;
}

export function requirementsById(
  model: PackModel | null | undefined
): Map<string, IdentifiedPackItem> {
  const out = new Map<string, IdentifiedPackItem>();
  for (const req of asArray(model && model.requirements)) {
    if (req && req.id) out.set(String(req.id), req as IdentifiedPackItem);
  }
  return out;
}

export function scenariosByRequirement(
  model: PackModel | null | undefined
): Map<string, PackItem[]> {
  const out = new Map<string, PackItem[]>();
  for (const sc of asArray(model && model.scenarios)) {
    if (!sc || !sc.requirement_id) continue;
    const key = String(sc.requirement_id);
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(sc);
  }
  return out;
}

/**
 * The fields that make a requirement what it is. Anything outside this set —
 * ordering, comments, template paths, the pack's own version — is not a
 * behavioural change and must not produce a delta.
 */
export function requirementFingerprint(
  req: PackItem,
  scenarios: PackItem[] | null | undefined
): string {
  const norm = (v: unknown) => String(v === undefined || v === null ? "" : v).trim();
  const scenarioPart = (scenarios || [])
    .map((sc: PackItem) =>
      [
        norm(sc.id),
        norm(sc.scenario),
        norm(sc.use_case),
        norm(sc.command),
        norm(sc.aggregate),
        asArray(sc.events).map(norm).sort().join(","),
      ].join("|")
    )
    .sort()
    .join("\n");
  return [
    norm(req.title),
    norm(req.description),
    norm(req.priority),
    norm(req.status),
    scenarioPart,
  ].join("\n");
}

// ── Gherkin extraction ────────────────────────────────────────────────────────

/**
 * `origin` records where a requirement came from.
 *
 * Provenance goes in the trace comment rather than in a new matrix column on
 * purpose: `parseTraceabilityRows` keys off a 10-cell row, and an eleventh
 * column would break every existing consumer of the matrix for a field only
 * tooling reads. The trace comment is already the extension point, and it
 * survives `archive` because the renderer writes the whole trace back out.
 */
export function traceComment(
  scenario: PackItem | null | undefined,
  origin?: string
): string | null {
  const parts: string[] = [];
  if (scenario) {
    if (scenario.use_case) parts.push(`uc=${scenario.use_case}`);
    if (scenario.command) parts.push(`cmd=${scenario.command}`);
    if (scenario.aggregate) parts.push(`agg=${scenario.aggregate}`);
    const events = asArray(scenario.events);
    if (events.length > 0) parts.push(`evt=${events[0]}`);
    if (scenario.target) parts.push(`feature=${scenario.target}`);
  }
  if (origin) parts.push(`origin=${origin}`);
  return parts.length > 0 ? `<!-- specgate:trace ${parts.join(" ")} -->` : null;
}

export function renderRequirementBlock(
  req: IdentifiedPackItem,
  scenarios: PackItem[] | null | undefined,
  packDir: string,
  t: Phrases,
  readSteps: ReadSteps,
  opts?: RequirementBlockOptions
): string {
  const o: RequirementBlockOptions = opts || {};
  const out: string[] = [];
  out.push(`### Requirement: ${req.id} — ${req.title || req.id}`);
  out.push("");

  if (o.bodyless) {
    out.push(o.reason || "(retirado por el pack.)");
    out.push("");
    while (out[out.length - 1] === "") out.pop();
    return out.join("\n");
  }

  const description = String(req.description || "").trim();
  out.push(description || t.systemShallMeet(req.title || req.id));
  if (req.priority) out.push("", t.priority(req.priority));
  out.push("");

  for (const sc of scenarios || []) {
    const name = sc.scenario || sc.id || "Scenario";
    out.push(`#### Scenario: ${sc.id ? `${sc.id} — ${name}` : name}`);
    out.push("");
    const steps = readSteps(packDir, sc);
    if (steps) {
      for (const step of steps) out.push(`- ${step}`);
    } else {
      out.push(t.todoSteps(name));
    }
    out.push("");
  }

  if ((scenarios || []).length === 0) {
    out.push(`#### Scenario: TODO — ${req.title || req.id}`);
    out.push("");
    out.push(t.todoStepsPlain);
    out.push("");
  }

  const trace = traceComment((scenarios || [])[0], o.origin);
  if (trace) {
    out.push(trace);
    out.push("");
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/**
 * Compare two versions of a pack and produce the delta markdown plus a summary.
 *
 * @returns { capability, markdown, summary: {added[], modified[], removed[]} }
 *          `markdown` is null when nothing behavioural changed.
 */
export function derivePackDelta(
  oldPack: LoadedPack | null,
  newPack: LoadedPack,
  packId: string,
  t: Phrases,
  readSteps: ReadSteps,
  opts?: { origin?: string }
): DerivedPackDelta {
  const options = opts || {};

  const oldReqs = oldPack ? requirementsById(oldPack.model) : new Map<string, IdentifiedPackItem>();
  const newReqs = requirementsById(newPack.model);
  const oldScenarios = oldPack
    ? scenariosByRequirement(oldPack.model)
    : new Map<string, PackItem[]>();
  const newScenarios = scenariosByRequirement(newPack.model);

  type Entry = { req: IdentifiedPackItem; scenarios: PackItem[] };
  const added: Entry[] = [];
  const modified: Entry[] = [];
  const removed: Entry[] = [];

  for (const [id, req] of newReqs) {
    if (!oldReqs.has(id)) {
      added.push({ req, scenarios: newScenarios.get(id) || [] });
      continue;
    }
    // Non-null: `oldReqs.has(id)` was checked just above.
    const before = requirementFingerprint(oldReqs.get(id)!, oldScenarios.get(id) || []);
    const after = requirementFingerprint(req, newScenarios.get(id) || []);
    if (before !== after) modified.push({ req, scenarios: newScenarios.get(id) || [] });
  }
  for (const [id, req] of oldReqs) {
    if (!newReqs.has(id)) removed.push({ req, scenarios: oldScenarios.get(id) || [] });
  }

  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return {
      capability: packId,
      markdown: null,
      summary: { added: [], modified: [], removed: [] },
    };
  }

  const lines = [`# Delta — ${packId}`, ""];
  const purpose = newPack.model && newPack.model.metadata && newPack.model.metadata.name;
  if (!oldPack && purpose) {
    lines.push("## Purpose", "", String(purpose), "");
  }

  const section = (heading: string, entries: Entry[], blockOpts?: RequirementBlockOptions) => {
    if (entries.length === 0) return;
    lines.push(`## ${heading}`, "");
    for (const entry of entries) {
      lines.push(
        renderRequirementBlock(entry.req, entry.scenarios, newPack.packDir, t, readSteps, {
          ...(blockOpts || {}),
          origin: options.origin,
        })
      );
      lines.push("");
    }
  };

  section("ADDED Requirements", added);
  section("MODIFIED Requirements", modified);
  section("REMOVED Requirements", removed, {
    bodyless: true,
    reason: "(retirado en esta versión del pack.)",
  });

  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  return {
    capability: packId,
    markdown: `${lines.join("\n")}\n`,
    summary: {
      added: added.map((e) => e.req.id),
      modified: modified.map((e) => e.req.id),
      removed: removed.map((e) => e.req.id),
    },
  };
}

// ── The proposal ──────────────────────────────────────────────────────────────

export function changeIdFor(packId: string, _fromVersion: string, toVersion: string): string {
  /**
   * Slugify in one pass, with no quantifier over the whole string.
   *
   * Every regex form of this — `[^a-zA-Z0-9.]+`, `-{2,}`, `^-+|-+$` — is a
   * global quantified scan, which restarts from each position and is what
   * `js/polynomial-redos` reports. Walking the characters once says the same
   * thing and cannot backtrack, and a change id is short enough that the
   * explicit version reads better anyway.
   */
  const slug = (v: unknown) => {
    const out: string[] = [];
    for (const ch of String(v)) {
      const keep =
        (ch >= "a" && ch <= "z") ||
        (ch >= "A" && ch <= "Z") ||
        (ch >= "0" && ch <= "9") ||
        ch === ".";
      if (keep) out.push(ch.toLowerCase());
      else if (out.length > 0 && out[out.length - 1] !== "-") out.push("-");
    }
    while (out.length > 0 && out[out.length - 1] === "-") out.pop();
    return out.join("");
  };
  return `upgrade-${slug(packId.split("/").pop())}-${slug(toVersion)}`;
}

export function renderProposal(
  entry: PackEntry,
  targetVersion: string,
  summary: PackDeltaSummary,
  t: Phrases
): string {
  const count = summary.added.length + summary.modified.length + summary.removed.length;
  const list = (label: string, ids: string[]) =>
    ids.length === 0 ? "" : `\n### ${label}\n\n${ids.map((id) => `- ${id}`).join("\n")}\n`;

  return `# Proposal: upgrade ${entry.pack_id} to ${targetVersion}

## Intent

El pack \`${entry.pack_id}\` pasa de \`${entry.version}\` a \`${targetVersion}\`.
Este cambio recoge **qué requisitos cambian**, derivados del modelo del pack, no
del diff de ficheros — lo que se revisa aquí es la intención del dominio.

## Scope

${count} requisito(s) afectado(s).
${list(t.added, summary.added)}${list(t.modified, summary.modified)}${list(t.removed, summary.removed)}
Fuera de alcance: la reconciliación de los ficheros generados, que sigue siendo
trabajo de \`specops sync\`.

## Approach

1. Revisar el delta de \`specs/${entry.pack_id}/spec.md\`.
2. Ejecutar \`specgate specops sync --pack ${entry.pack_id} --pack-version ${targetVersion}\`.
3. Resolver los conflictos que el merge de tres vías marque.
4. Archivar este cambio para consolidar los requisitos en las specs y la matriz.

> Los pasos marcados \`TODO:\` en el delta son escenarios que el pack declara sin
> plantilla Gherkin legible. Complétalos antes de archivar.
`;
}

export function renderTasks(entry: PackEntry, targetVersion: string): string {
  return `# Tasks

## 1. Review

- [ ] 1.1 Revisar el delta requisito a requisito
- [ ] 1.2 Completar los pasos marcados \`TODO:\`

## 2. Apply

- [ ] 2.1 \`specgate specops sync --pack ${entry.pack_id} --pack-version ${targetVersion}\`
- [ ] 2.2 Resolver conflictos del merge de tres vías
- [ ] 2.3 \`specgate change validate\`
`;
}
