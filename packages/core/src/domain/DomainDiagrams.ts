/**
 * The entity model and the actors diagram, generated — never hand-kept
 * (REQ-540, REQ-541).
 *
 * A business reader understands a model as a diagram, not as YAML. Both files
 * are rendered from sources the project already keeps — the aggregates the
 * packs wrote, `docs/specs/model.yaml`, the brief's actors and the `actor=` of
 * each requirement — so `check` keeps them current and `validate` reports a
 * committed copy that differs, as it does for a generated matrix. Mermaid,
 * because GitHub, GitLab and the studio render it without a server.
 *
 * Pure: sources in, Markdown out, the same bytes for the same sources.
 */

import { parseYamlLite } from "./YamlLite";

export const MODEL_FILE = "docs/specs/model.md";
export const MODEL_SOURCE = "docs/specs/model.yaml";
export const AGGREGATES_FILE = "docs/specs/aggregates.md";
export const ACTORS_FILE = "docs/specs/actors.md";

export interface Attribute {
  readonly name: string;
  readonly type: string;
  /** `PK`, `FK` or "". */
  readonly key: string;
}

export interface Relation {
  readonly to: string;
  readonly kind: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  readonly label: string;
}

export interface Entity {
  readonly name: string;
  readonly context: string;
  readonly notes: string;
  readonly attributes: readonly Attribute[];
  readonly relations: readonly Relation[];
}

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** The template's own example row, which is not an aggregate anybody has. */
const PLACEHOLDER = /^coreaggregate$/i;

/** The aggregates of `docs/specs/aggregates.md`, the table packs write. */
export function aggregatesIn(md: string | null): Entity[] {
  if (!md) return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const header = lines.findIndex((l) => /^\s*\|/.test(l) && /\baggregate\b/i.test(l));
  if (header === -1) return [];
  const cols = cellsOf(lines[header]).map((c) => c.toLowerCase());
  const col = (n: string) => cols.indexOf(n);
  const out: Entity[] = [];
  for (const line of lines.slice(header + 1)) {
    if (!/^\s*\|/.test(line)) break;
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const c = cellsOf(line);
    const name = (c[col("aggregate")] || "").replace(/[`*]/g, "");
    if (!name || PLACEHOLDER.test(name)) continue;
    const notes = [c[col("responsibilities")], c[col("invariants")]]
      .filter((x) => x && x !== "-")
      .join(" — ");
    out.push({ name, context: c[col("context")] || "", notes, attributes: [], relations: [] });
  }
  return out;
}

const KINDS = new Set(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]);

/**
 * `docs/specs/model.yaml`:
 *
 *     entities:
 *       - name: Invoice
 *         attributes: ["id uuid PK", "total money"]
 *         relations:
 *           - to: Payment
 *             kind: one-to-many
 *             label: settled by
 */
export function modelSourceEntities(yaml: string | null): Entity[] {
  if (!yaml) return [];
  const doc = parseYamlLite(yaml) as { entities?: unknown };
  const list = Array.isArray(doc.entities) ? doc.entities : [];
  return list
    .map((raw) => {
      const e = (raw || {}) as Record<string, unknown>;
      const name = String(e.name || "").trim();
      const attributes = (Array.isArray(e.attributes) ? e.attributes : [])
        .map((a) => String(a).trim().split(/\s+/))
        .filter((p) => p[0])
        .map(([n, type = "string", key = ""]) => ({ name: n, type, key: key.toUpperCase() }));
      const relations = (Array.isArray(e.relations) ? e.relations : [])
        .map((r) => (r || {}) as Record<string, unknown>)
        .filter((r) => r.to && KINDS.has(String(r.kind)))
        .map((r) => ({
          to: String(r.to),
          kind: String(r.kind) as Relation["kind"],
          label: String(r.label || "has"),
        }));
      return {
        name,
        context: String(e.context || ""),
        notes: String(e.notes || ""),
        attributes,
        relations,
      };
    })
    .filter((e) => e.name);
}

/** The aggregates, with what model.yaml says about each — and model.yaml's own entities. */
export function mergeEntities(aggregates: readonly Entity[], model: readonly Entity[]): Entity[] {
  const byName = new Map<string, Entity>();
  for (const a of aggregates) byName.set(a.name, a);
  for (const m of model) {
    const a = byName.get(m.name);
    byName.set(
      m.name,
      a
        ? {
            ...a,
            context: m.context || a.context,
            notes: m.notes || a.notes,
            attributes: m.attributes,
            relations: m.relations,
          }
        : m
    );
  }
  return [...byName.values()].sort((x, y) => x.name.localeCompare(y.name));
}

const ER_LINK: Record<Relation["kind"], string> = {
  "one-to-one": "||--||",
  "one-to-many": "||--o{",
  "many-to-one": "}o--||",
  "many-to-many": "}o--o{",
};
const ident = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");
const cell = (s: string) => (s || "-").replace(/\|/g, "\\|");

/** `docs/specs/model.md`, or null when there is nothing to draw. */
export function renderModel(entities: readonly Entity[]): string | null {
  if (entities.length === 0) return null;
  const er: string[] = ["erDiagram"];
  for (const e of entities) {
    if (e.attributes.length === 0) {
      er.push(`  ${ident(e.name)} {`, `    string id`, `  }`);
      continue;
    }
    er.push(`  ${ident(e.name)} {`);
    for (const a of e.attributes)
      er.push(`    ${ident(a.type)} ${ident(a.name)}${a.key ? ` ${a.key}` : ""}`);
    er.push("  }");
  }
  for (const e of entities) {
    for (const r of e.relations) {
      er.push(
        `  ${ident(e.name)} ${ER_LINK[r.kind]} ${ident(r.to)} : "${r.label.replace(/"/g, "'")}"`
      );
    }
  }
  const out = [
    "# Entity model",
    "",
    "<!-- Generated by specgate from docs/specs/aggregates.md and docs/specs/model.yaml.",
    "     Do not edit: `specgate check` rewrites it, and `validate` reports a copy that differs. -->",
    "",
    "```mermaid",
    ...er,
    "```",
    "",
  ];
  for (const e of entities) {
    out.push(`## ${e.name}`, "");
    if (e.context) out.push(`**Context:** ${e.context}`, "");
    if (e.notes) out.push(e.notes, "");
    if (e.attributes.length > 0) {
      out.push("| Attribute | Type | Key |", "| --- | --- | --- |");
      for (const a of e.attributes)
        out.push(`| ${cell(a.name)} | ${cell(a.type)} | ${cell(a.key)} |`);
      out.push("");
    }
  }
  return out.join("\n");
}

// ── REQ-541: actors ─────────────────────────────────────────────────────────

export interface ActorRequirement {
  readonly id: string;
  readonly title: string;
  /** The capability it belongs to; "spec" for one in spec.md. */
  readonly capability: string;
  readonly actor: string;
}

/** `docs/specs/actors.md`, or null when the brief names no actor. */
export function renderActors(
  actors: readonly string[],
  requirements: readonly ActorRequirement[]
): string | null {
  if (actors.length === 0) return null;
  const known = new Set(actors);
  const reqs = [...requirements]
    .filter((r) => known.has(r.actor))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const caps = [...new Set(reqs.map((r) => r.capability))].sort();
  const node = (prefix: string, s: string) => `${prefix}_${ident(s)}`;
  const label = (s: string) => s.replace(/"/g, "'");
  const fc = ["flowchart LR"];
  for (const a of [...actors].sort()) fc.push(`  ${node("actor", a)}(["${label(a)}"])`);
  for (const c of caps) fc.push(`  ${node("cap", c)}["${label(c)}"]`);
  for (const r of reqs) fc.push(`  ${node("req", r.id)}["${r.id} — ${label(r.title)}"]`);
  const links = new Set<string>();
  for (const r of reqs) {
    links.add(`  ${node("actor", r.actor)} --> ${node("cap", r.capability)}`);
    links.add(`  ${node("cap", r.capability)} --> ${node("req", r.id)}`);
  }
  fc.push(...links);
  return [
    "# Actors",
    "",
    "<!-- Generated by specgate from docs/brief.md's actors and each requirement's actor=.",
    "     Do not edit: `specgate check` rewrites it, and `validate` reports a copy that differs. -->",
    "",
    "```mermaid",
    ...fc,
    "```",
    "",
    "| Actor | Requirements |",
    "| --- | --- |",
    ...[...actors].sort().map((a) => {
      const ids = reqs.filter((r) => r.actor === a).map((r) => r.id);
      return `| ${a} | ${ids.length ? ids.join(", ") : "-"} |`;
    }),
    "",
  ].join("\n");
}
