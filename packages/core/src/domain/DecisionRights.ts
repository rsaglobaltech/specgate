/**
 * What the agent may decide on its own, and what it must leave to a person
 * (REQ-547).
 *
 * Some changes are not implementation detail even when a requirement needs
 * them: a new dependency is a supply-chain and licence decision, a migration
 * changes data that outlives the code, and a new public API operation is a
 * promise to every client. `docs/specs/decision-rights.md` says, for each of
 * the three, `agent` or `ask`. The prompt carries the table, and the harness
 * checks the diff: an attempt that took a decision kept for a person fails,
 * whatever its tests say.
 *
 * Only the three decisions a diff can show are checked, and each is read from
 * the files that hold it — never guessed from prose. Pure: text in, findings out.
 */

export const DECISION_RIGHTS_FILE = "docs/specs/decision-rights.md";

export const DECISIONS = ["dependency", "migration", "public-api"] as const;
export type Decision = (typeof DECISIONS)[number];
export type Right = "agent" | "ask";

export interface DecisionRights {
  readonly rights: ReadonlyMap<Decision, Right>;
  /** Rows that name a decision this file does not know, or no right. */
  readonly problems: readonly string[];
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim().replace(/`/g, "").toLowerCase());

/** The table: a row per decision, with `agent` or `ask` in one of its cells. */
export function parseDecisionRights(md: string): DecisionRights {
  const rights = new Map<Decision, Right>();
  const problems: string[] = [];
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const row = cells(line);
    if (row[0] === "decision") continue;
    const decision = DECISIONS.find((d) => d === row[0]);
    const right = row.slice(1).find((c) => c === "agent" || c === "ask") as Right | undefined;
    if (!decision) {
      problems.push(`unknown decision "${row[0]}" (known: ${DECISIONS.join(", ")})`);
      continue;
    }
    if (!right) {
      problems.push(`${decision} has no right: write agent or ask`);
      continue;
    }
    rights.set(decision, right);
  }
  return { rights, problems };
}

/** The file `specgate init` could write: every decision kept for a person. */
export function decisionRightsTemplate(): string {
  return [
    "# Decision rights",
    "",
    "What the agent may decide on its own (`agent`) and what it must leave to a",
    "person (`ask`). The harness checks the diff of every attempt against it.",
    "",
    "| Decision | Right | Checked in |",
    "| --- | --- | --- |",
    "| dependency | ask | a dependency added to a build manifest |",
    "| migration | ask | a file added to a migration folder |",
    "| public-api | ask | an operation added to an OpenAPI file |",
    "",
  ].join("\n");
}

// ── What a diff shows ───────────────────────────────────────────────────────

const base = (p: string) => p.split("/").pop() || p;

/** A build manifest that declares dependencies. */
export function isManifest(p: string): boolean {
  const b = base(p);
  return (
    /^(package\.json|composer\.json|pom\.xml|build\.gradle(\.kts)?|go\.mod|Cargo\.toml|Gemfile|pyproject\.toml)$/.test(
      b
    ) ||
    /^requirements[\w.-]*\.txt$/.test(b) ||
    /\.csproj$/.test(b)
  );
}

/** A file in a migration folder: Flyway, Rails, Django, Alembic, Prisma, Liquibase, Knex, … */
export function isMigrationPath(p: string): boolean {
  return /(^|\/)(migrations?|db\/migrate|alembic\/versions|db\/changelog)\//i.test(p);
}

/** An OpenAPI or Swagger document. */
export function isOpenApi(p: string): boolean {
  return /^(openapi|swagger)[\w.-]*\.(ya?ml|json)$/i.test(base(p)) || /(^|\/)openapi\//i.test(p);
}

const JSON_DEP_KEYS: Record<string, string[]> = {
  "package.json": ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"],
  "composer.json": ["require", "require-dev"],
};

const CARGO_FIELDS = new Set([
  "name",
  "version",
  "edition",
  "authors",
  "description",
  "license",
  "repository",
  "readme",
  "homepage",
]);

/** The line patterns that declare one dependency, per manifest. */
function dependencyLine(file: string): ((line: string) => boolean) | null {
  const b = base(file);
  if (b === "pom.xml") return (l) => /<artifactId>[^<]+<\/artifactId>/.test(l);
  if (/^build\.gradle/.test(b)) {
    return (l) =>
      /^\s*(implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt)\b/.test(
        l
      );
  }
  if (b === "go.mod") return (l) => /^\s*(require\s+)?[\w.-]+\.[\w./-]+\s+v\d/.test(l);
  if (/^requirements/.test(b)) return (l) => /^[A-Za-z0-9_.[\]-]+/.test(l.trim());
  if (b === "Gemfile") return (l) => /^\s*gem\s+['"]/.test(l);
  if (/\.csproj$/.test(b)) return (l) => /<PackageReference\s/.test(l);
  if (b === "pyproject.toml") {
    return (l) =>
      /^\s*"[A-Za-z0-9_.[\]-]+\s*([<>=~!^].*)?",?\s*$/.test(l) ||
      /^[A-Za-z0-9_.-]+\s*=\s*["{]/.test(l.trim());
  }
  if (b === "Cargo.toml") {
    return (l) => {
      const m = /^([A-Za-z0-9_-]+)\s*=\s*["{]/.exec(l.trim());
      return !!m && !CARGO_FIELDS.has(m[1]);
    };
  }
  return null;
}

/** The dependencies a manifest gained: names for JSON manifests, the new lines otherwise. */
export function addedDependencies(file: string, before: string | null, after: string): string[] {
  const keys = JSON_DEP_KEYS[base(file)];
  if (keys) {
    const deps = (text: string | null) => {
      const out = new Set<string>();
      if (!text) return out;
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        for (const k of keys) {
          const section = data[k];
          if (section && typeof section === "object") {
            for (const name of Object.keys(section)) out.add(name);
          }
        }
      } catch {
        // An unreadable manifest is the gate's to fail, not this check's.
      }
      return out;
    };
    const had = deps(before);
    return [...deps(after)].filter((d) => !had.has(d));
  }
  const isDep = dependencyLine(file);
  if (!isDep) return [];
  const had = new Set((before || "").split(/\r?\n/).map((l) => l.trim()));
  return after
    .split(/\r?\n/)
    .filter((l) => isDep(l) && !l.trim().startsWith("#") && !had.has(l.trim()))
    .map((l) => l.trim());
}

const OPERATION_YAML = /^\s+(get|put|post|delete|patch|options|head|trace):\s*$/;
const OPERATION_JSON = /"(get|put|post|delete|patch|options|head|trace)"\s*:\s*\{/g;

/** How many operations an OpenAPI document declares. */
export function operationCount(text: string | null): number {
  if (!text) return 0;
  const json = text.trimStart().startsWith("{");
  return json
    ? (text.match(OPERATION_JSON) || []).length
    : text.split(/\r?\n/).filter((l) => OPERATION_YAML.test(l)).length;
}

export interface ChangedFile {
  readonly path: string;
  /** The file at the base commit; null when the agent created it. */
  readonly before: string | null;
  /** The file now; null when the agent deleted it. */
  readonly after: string | null;
}

export interface DecisionExceeded {
  readonly decision: Decision;
  readonly file: string;
  /** What was decided: the dependency, the migration file, the operations added. */
  readonly detail: string;
}

/** Every decision kept for a person (`ask`) that the agent's changes took anyway. */
export function decisionsExceeded(
  rights: ReadonlyMap<Decision, Right>,
  changes: readonly ChangedFile[]
): DecisionExceeded[] {
  const asks = (d: Decision) => rights.get(d) === "ask";
  const out: DecisionExceeded[] = [];
  for (const c of [...changes].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    if (c.after === null) continue;
    if (asks("dependency") && isManifest(c.path)) {
      const added = addedDependencies(c.path, c.before, c.after);
      if (added.length > 0) {
        out.push({ decision: "dependency", file: c.path, detail: added.join(", ") });
      }
    }
    if (asks("migration") && c.before === null && isMigrationPath(c.path)) {
      out.push({ decision: "migration", file: c.path, detail: "a new migration" });
    }
    if (asks("public-api") && isOpenApi(c.path)) {
      const more = operationCount(c.after) - operationCount(c.before);
      if (more > 0)
        out.push({ decision: "public-api", file: c.path, detail: `${more} operation(s) added` });
    }
  }
  return out;
}
