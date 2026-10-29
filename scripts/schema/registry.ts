/**
 * Artefact schemas — which artefacts a change produces, and in what order.
 *
 * ADR-0018 fixed the semantics: dependencies are **enablers, not gates**. A
 * schema says "tasks make more sense once the specs exist", never "you are
 * forbidden from writing tasks first". Making this configurable does not
 * change that; it changes *which* artefacts a team recognises.
 *
 * Two schemas ship. `spec-driven` reproduces the flow the tool has always had.
 * `bdd-first` is an opinion: the executable scenario comes before the prose
 * spec, because a team with Cucumber already writes the `.feature` first and
 * the spec afterwards to explain it.
 *
 * A project overrides either by forking it into `.specgate/schemas/<name>/schema.yaml`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const SCHEMA_DIR = path.join(".specgate", "schemas");
export const SCHEMA_FILE = "schema.yaml";

/** One artefact in a schema: what it generates and what it waits for. */
export interface SchemaArtifact {
  id: string;
  generates: string;
  requires: string[];
}

/** A parsed artefact schema — `artifacts` plus whatever scalars it declares. */
export interface ArtifactSchema {
  artifacts: SchemaArtifact[];
  [key: string]: SchemaArtifact[] | string | undefined;
}

/** A schema that ships with the CLI: always named and described. */
export interface BuiltInSchema extends ArtifactSchema {
  name: string;
  description: string;
}

/** A structural problem in a schema, before it becomes a diagnostic. */
export interface SchemaProblem {
  code: string;
  message: string;
  target?: string;
}

/** A schema found by name, and where it was found. */
export interface ResolvedSchema {
  source: "project" | "built-in";
  /** Relative to the project; null for a built-in. */
  path: string | null;
  schema: ArtifactSchema;
}

export const BUILT_IN: Record<string, BuiltInSchema> = {
  "spec-driven": {
    name: "spec-driven",
    description: "Proposal first, then the delta specs, then the tasks. The default.",
    artifacts: [
      { id: "proposal", generates: "proposal.md", requires: [] },
      { id: "specs", generates: "specs/**/spec.md", requires: ["proposal"] },
      { id: "design", generates: "design.md", requires: ["proposal"] },
      { id: "tasks", generates: "tasks.md", requires: ["specs", "design"] },
    ],
  },
  // ADR-0042: what new changes follow from 1.0 on. Each layer has its owner:
  // discover.md (product), design.md (architect), tasks.md (developer).
  layered: {
    name: "layered",
    description:
      "Discover (product), then the delta specs and the Design (architect), then the Tasks (developer). The default for new changes.",
    artifacts: [
      { id: "discover", generates: "discover.md", requires: [] },
      { id: "specs", generates: "specs/**/spec.md", requires: ["discover"] },
      { id: "design", generates: "design.md", requires: ["discover"] },
      { id: "tasks", generates: "tasks.md", requires: ["specs", "design"] },
    ],
  },
  "bdd-first": {
    name: "bdd-first",
    description:
      "The executable scenario before the prose spec. For teams whose Cucumber suite is the real contract.",
    artifacts: [
      { id: "proposal", generates: "proposal.md", requires: [] },
      { id: "feature", generates: "features/**/*.feature", requires: ["proposal"] },
      { id: "specs", generates: "specs/**/spec.md", requires: ["feature"] },
      { id: "design", generates: "design.md", requires: ["proposal"] },
      { id: "tasks", generates: "tasks.md", requires: ["specs", "design"] },
    ],
  },
};

/** Minimal YAML emitter for a schema — the repo has no YAML dependency. */
export function toYaml(schema: ArtifactSchema): string {
  const lines = [
    `# ${schema.description}`,
    "#",
    "# Dependencies are enablers, not gates (ADR-0018): `requires` says what makes",
    "# an artefact easier to write, never what blocks it.",
    `name: ${schema.name}`,
    // Backslash first — see PackContribution.yamlString.
    `description: "${String(schema.description).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    "artifacts:",
  ];
  for (const a of schema.artifacts) {
    lines.push(`  - id: ${a.id}`);
    lines.push(`    generates: "${a.generates}"`);
    lines.push(
      a.requires.length === 0 ? "    requires: []" : `    requires: [${a.requires.join(", ")}]`
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Parse the subset of YAML a schema file uses. Hand-rolled to keep the CLI's
 * zero-runtime-dependency promise, and narrow on purpose: anything richer than
 * this list-of-maps shape is rejected rather than half-understood.
 */
export function parseYaml(text: string): ArtifactSchema {
  const schema: ArtifactSchema = { artifacts: [] };
  // Open to the fields this parser does not name: a fork may add its own.
  let current: (SchemaArtifact & Record<string, string | string[]>) | null = null;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const top = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (top && !line.startsWith(" ")) {
      if (top[1] === "artifacts") continue;
      schema[top[1]] = unquote(top[2]);
      continue;
    }

    const item = /^\s*-\s*id:\s*(.+)$/.exec(line);
    if (item) {
      current = { id: unquote(item[1]), generates: "", requires: [] };
      schema.artifacts.push(current);
      continue;
    }

    const field = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (field && current) {
      const [, key, value] = field;
      if (key === "requires") {
        const inner = value
          .trim()
          .replace(/^\[|\]$/g, "")
          .trim();
        current.requires = inner
          ? inner
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
      } else {
        current[key] = unquote(value);
      }
    }
  }
  return schema;
}

function unquote(value: string | undefined): string {
  const v = (value || "").trim();
  return v.replace(/^["']|["']$/g, "");
}

/**
 * Structural problems, as diagnostics rather than exceptions. A schema that
 * names a dependency it does not declare would silently mark every artefact
 * blocked, which looks like the tool being broken.
 */
export function validateSchema(schema: ArtifactSchema): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  if (!schema.name) {
    problems.push({ code: "schema_no_name", message: "The schema has no `name`." });
  }
  if (!Array.isArray(schema.artifacts) || schema.artifacts.length === 0) {
    problems.push({ code: "schema_no_artifacts", message: "The schema declares no artifacts." });
    return problems;
  }

  const ids = new Set<string>();
  for (const a of schema.artifacts) {
    if (!a.id) {
      problems.push({ code: "artifact_no_id", message: "An artifact has no `id`." });
      continue;
    }
    if (ids.has(a.id)) {
      problems.push({
        code: "artifact_duplicate_id",
        message: `Duplicate artifact id: ${a.id}.`,
        target: a.id,
      });
    }
    ids.add(a.id);
    if (!a.generates) {
      problems.push({
        code: "artifact_no_output",
        message: `Artifact ${a.id} does not say what it generates.`,
        target: a.id,
      });
    }
  }

  for (const a of schema.artifacts) {
    for (const dep of a.requires || []) {
      if (!ids.has(dep)) {
        problems.push({
          code: "artifact_unknown_dependency",
          message: `Artifact ${a.id} requires "${dep}", which the schema does not declare.`,
          target: a.id,
        });
      }
    }
  }

  const cycle = findCycle(schema.artifacts);
  if (cycle) {
    problems.push({
      code: "artifact_cycle",
      message: `Artifacts form a cycle: ${cycle.join(" → ")}.`,
      target: cycle[0],
    });
  }
  return problems;
}

export function findCycle(artifacts: readonly SchemaArtifact[]): string[] | null {
  const byId = new Map<string, SchemaArtifact>(artifacts.map((a) => [a.id, a]));
  const state = new Map<string, "visiting" | "done">();
  let cycle: string[] | null = null;

  function visit(id: string, trail: string[]): void {
    if (cycle) return;
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      cycle = [...trail.slice(trail.indexOf(id)), id];
      return;
    }
    state.set(id, "visiting");
    for (const dep of (byId.get(id) || { requires: [] }).requires || []) {
      if (byId.has(dep)) visit(dep, [...trail, id]);
    }
    state.set(id, "done");
  }

  for (const a of artifacts) visit(a.id, []);
  return cycle;
}

/** Where a schema comes from: the project's fork, or the built-in. */
export function resolveSchema(
  projectDir: string,
  name: string | null | undefined
): ResolvedSchema | null {
  const wanted = name || "spec-driven";
  const forked = path.join(projectDir, SCHEMA_DIR, wanted, SCHEMA_FILE);
  if (fs.existsSync(forked)) {
    return {
      source: "project",
      path: path.join(SCHEMA_DIR, wanted, SCHEMA_FILE),
      schema: parseYaml(fs.readFileSync(forked, "utf8")),
    };
  }
  if (BUILT_IN[wanted]) {
    return { source: "built-in", path: null, schema: BUILT_IN[wanted] };
  }
  return null;
}

export function listSchemas(projectDir: string): string[] {
  const names = new Set(Object.keys(BUILT_IN));
  const dir = path.join(projectDir, SCHEMA_DIR);
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, SCHEMA_FILE))) {
        names.add(entry.name);
      }
    }
  }
  return [...names].sort();
}
