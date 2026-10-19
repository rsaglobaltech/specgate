/**
 * What a `pack.yaml` is allowed to say, and how to check it.
 *
 * `schemas/pack.schema.json` remains the authority on the file format; this is
 * the CLI's own reading of it, kept here because validating a pack is a
 * judgement about its contents rather than about a disk. The one thing that
 * genuinely needs a filesystem — does this template file exist — arrives as
 * the `templateExists` predicate, so `specgate pack lint` and `specgate expand` share
 * one set of rules without the rules importing `fs`.
 */

import * as path from "node:path";

function toPosixPath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}

export function isSafeRelativePath(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  if (path.isAbsolute(candidate)) return false;

  const normalized = toPosixPath(path.posix.normalize(candidate));
  if (normalized.startsWith("../") || normalized === "..") return false;
  if (normalized.includes("/../")) return false;
  return true;
}

function fail(message: string): never {
  throw new Error(message);
}
/**
 * Highest `pack.yaml` schema this CLI can read. Bump it in the same change
 * that adds a field to `schemas/pack.schema.json`, or packs authored against
 * the new field will be rejected by a CLI that in fact understands them.
 */
export const PACK_SCHEMA_VERSION = "1.5.0";

/** Project types a pack may target. Mirrors the enum in schemas/pack.schema.json. */
export const PACK_PROJECT_TYPES = ["backend", "frontend", "mobile", "contracts"];

/**
 * How much a pack can be trusted. Mirrors the enum in schemas/pack.schema.json.
 * `proven`: every requirement was implemented and tested by a real product.
 * `starter`: a generic example of the format. A pack that says nothing is a starter.
 */
export const PACK_TIERS = ["proven", "starter"];

/**
 * Numeric SemVer comparison for schema versions — `a > b`.
 *
 * Deliberately not a SemVer library: schema versions here are always three
 * plain integers (the JSON schema enforces `^\d+\.\d+\.\d+$`), so there are no
 * pre-release or build parts to handle, and this project ships no runtime
 * dependencies.
 */
export function isNewerThan(a: string, b: string): boolean {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * One entry of a pack collection — a requirement, use case, aggregate, event,
 * scenario — as the validator reads it. Open, because each collection has its
 * own fields and `schemas/pack.schema.json` is the authority on them; what is
 * named here is what the rules below look at. Nothing in it is trusted until
 * `validatePackModel` has checked it.
 */
export interface PackItem {
  id?: string;
  name?: string;
  title?: string;
  status?: string;
  priority?: string;
  description?: string;
  depends_on?: string | string[];
  /** Scenario fields: its name, its requirement, and the domain it touches. */
  scenario?: string;
  requirement_id?: string;
  use_case?: string;
  command?: string;
  aggregate?: string;
  events?: string | string[];
  /** A scenario's rendered feature file and the template it comes from. */
  target?: string;
  template?: string;
  [field: string]: unknown;
}

/**
 * The parts of a `pack.yaml` that `validatePackModel` judges, typed as a valid
 * pack would have them. A view over parsed YAML rather than a guarantee: the
 * function exists to find the places where the file disagrees with this shape.
 */
export interface PackManifest {
  schema_version?: string;
  metadata?: {
    name?: string;
    version?: string;
    language?: string;
    project_type?: string;
    tier?: string;
    provenance?: string;
    [key: string]: unknown;
  };
  variables?: { required?: string[]; [key: string]: unknown };
  outputs?: { files?: Array<{ target?: string; template?: string }> };
  rules?: { traceability?: { target?: string } };
  requirements?: PackItem[];
  bounded_contexts?: PackItem[];
  business_rules?: PackItem[];
  use_cases?: PackItem[];
  commands?: PackItem[];
  queries?: PackItem[];
  aggregates?: PackItem[];
  events?: PackItem[];
  value_objects?: PackItem[];
  scenarios?: PackItem[];
  [key: string]: unknown;
}

export const ALLOWED_STATUSES = new Set([
  "Draft",
  "Needs Clarification",
  "Domain Reviewed",
  "Architecture Reviewed",
  "Ready for Dev",
  "In Dev",
  "In Review",
  "Verified",
  "Released",
  "Deprecated",
]);

const ALLOWED_PRIORITIES = new Set(["Must", "Should", "Could", "Won't"]);

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

/**
 * A pack section as a list of `T`: a lone value is a list of one. The YAML is
 * not checked against `T` here — callers read the entries field by field and
 * tolerate what is missing, which is what `T`'s optional fields say.
 */
export function sectionItems<T>(value: unknown): T[] {
  return asArray(value) as T[];
}

export function formatList(value: unknown, fallback = "-"): string {
  const items = asArray(value)
    .map((item) => String(item).trim())
    .filter(Boolean);
  return items.length > 0 ? items.join(", ") : fallback;
}

export function entityLabel(entity: PackItem | string | null | undefined, fallback = "-"): string {
  if (!entity) return fallback;
  if (typeof entity === "string") return entity;
  if (entity.id && entity.name) return `${entity.id} ${entity.name}`;
  if (entity.id) return entity.id;
  if (entity.name) return entity.name;
  return fallback;
}

export function hasStructuredDomainModel(pack: Record<string, unknown>): boolean {
  return [
    "requirements",
    "bounded_contexts",
    "use_cases",
    "commands",
    "queries",
    "aggregates",
    "events",
    "value_objects",
  ].some((key) => Array.isArray(pack[key]) && pack[key].length > 0);
}
/** The pack collections a reference can point into, by their `pack.yaml` key. */
type RefCollection =
  | "requirements"
  | "bounded_contexts"
  | "use_cases"
  | "commands"
  | "queries"
  | "aggregates"
  | "events"
  | "value_objects"
  | "business_rules";

/**
 * Does this absolute path exist? Supplied by the caller so the rules below stay
 * free of `fs`; `DiskPackRepository.validatePackModel` passes the real disk check.
 */
export type TemplateExists = (absolutePath: string) => boolean;

/**
 * Refuse a `depends_on` graph that never terminates.
 *
 * Depth-first, reporting the first cycle with the way round it goes — "REQ-001
 * → REQ-002 → REQ-001" is a fix; "there is a cycle" is a puzzle. `runLevels`
 * already declines to loop forever, but it discovers this at run time, with the
 * pack installed and an agent about to be paid for.
 */
function assertNoDependencyCycle(dependsOn: Map<string, string[]>, fail: (m: string) => void) {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const walk = (id: string): boolean => {
    if (state.get(id) === "done") return false;
    if (state.get(id) === "visiting") {
      const from = stack.indexOf(id);
      fail(`Requirement dependency cycle: ${[...stack.slice(from), id].join(" → ")}.`);
      return true;
    }
    state.set(id, "visiting");
    stack.push(id);
    for (const dep of dependsOn.get(id) || []) {
      if (walk(dep)) return true;
    }
    stack.pop();
    state.set(id, "done");
    return false;
  };

  for (const id of dependsOn.keys()) {
    if (walk(id)) return;
  }
}

export function validatePackModel(
  pack: PackManifest,
  packRoot: string,
  templateExists: TemplateExists
): { requiredVars: string[] } {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    fail("Invalid pack format. Root must be an object.");
  }

  const metadata = pack.metadata || {};
  const requiredMetadata = ["name", "version", "language", "project_type"];
  for (const key of requiredMetadata) {
    if (!metadata[key] || typeof metadata[key] !== "string") {
      fail(`metadata.${key} is required and must be a string.`);
    }
  }

  // Kept in step with the enum in schemas/pack.schema.json — the schema is the
  // authority, and the two disagreeing is what made `contracts` packs
  // scaffoldable but impossible to install.
  // Non-null: the loop above refused a missing or non-string project_type.
  if (!PACK_PROJECT_TYPES.includes(metadata.project_type!)) {
    fail(
      `metadata.project_type must be one of ${PACK_PROJECT_TYPES.join(", ")}. ` +
        `Found '${metadata.project_type}'.`
    );
  }

  // `tier` says how much to trust the pack (schema 1.5.0). A pack calling
  // itself proven has to say what proved it: "proven" with nothing behind it is
  // the claim the eleven starter packs used to make by being called curated.
  if (metadata.tier !== undefined && !PACK_TIERS.includes(metadata.tier)) {
    fail(`metadata.tier must be one of ${PACK_TIERS.join(", ")}. Found '${metadata.tier}'.`);
  }
  if (metadata.provenance !== undefined && typeof metadata.provenance !== "string") {
    fail("metadata.provenance must be a string when provided.");
  }
  if (metadata.tier === "proven" && !String(metadata.provenance || "").trim()) {
    fail(
      "metadata.tier is 'proven' but metadata.provenance is empty. Say which product " +
        "implemented and tested these requirements, or declare the pack a starter."
    );
  }

  const requiredVars =
    pack.variables && Array.isArray(pack.variables.required) ? pack.variables.required : [];

  if (requiredVars.length === 0) {
    fail("variables.required must contain at least one variable.");
  }

  for (const varName of requiredVars) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) {
      fail(`Invalid variable name in variables.required: '${varName}'.`);
    }
  }

  const outputs = pack.outputs || {};
  if (!Array.isArray(outputs.files) || outputs.files.length === 0) {
    fail("outputs.files must contain at least one file definition.");
  }

  const targets = new Set<string>();
  const refs: Record<RefCollection, Map<string, PackItem>> = {
    requirements: new Map(),
    bounded_contexts: new Map(),
    use_cases: new Map(),
    commands: new Map(),
    queries: new Map(),
    aggregates: new Map(),
    events: new Map(),
    value_objects: new Map(),
    business_rules: new Map(),
  };

  function remember(collectionName: RefCollection, item: PackItem, label: string) {
    if (!item || typeof item !== "object") {
      fail(`${collectionName} entries must be objects.`);
    }

    if (!item.id || typeof item.id !== "string") {
      fail(`${collectionName} entry is missing required string field 'id'.`);
    }

    const map = refs[collectionName];
    if (map.has(item.id)) {
      fail(`Duplicate ${label} id detected: '${item.id}'.`);
    }
    map.set(item.id, item);

    if (item.name && typeof item.name === "string") {
      if (map.has(item.name)) {
        fail(`Duplicate ${label} name/reference detected: '${item.name}'.`);
      }
      map.set(item.name, item);
    }
  }

  function hasRef(collectionName: RefCollection, ref: unknown) {
    if (!ref) return false;
    return refs[collectionName].has(String(ref));
  }

  function assertRef(collectionName: RefCollection, ref: unknown, context: string) {
    if (!ref) return;
    if (!hasRef(collectionName, ref)) {
      fail(`${context} references unknown ${collectionName.slice(0, -1)} '${ref}'.`);
    }
  }

  function assertRefs(collectionName: RefCollection, values: unknown, context: string) {
    for (const ref of asArray(values)) {
      assertRef(collectionName, ref, context);
    }
  }

  function assertStatus(status: string | undefined, context: string) {
    if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
      fail(`${context} has invalid status '${status}'.`);
    }
  }

  function assertTemplateExists(templatePath: string | undefined, context: string) {
    if (!isSafeRelativePath(templatePath)) {
      fail(`${context} template path '${templatePath}' is invalid.`);
    }

    // Non-null: isSafeRelativePath refused anything but a non-empty string.
    const absolute = path.resolve(packRoot, templatePath!);
    if (!absolute.startsWith(packRoot)) {
      fail(`${context} template escapes pack root: ${templatePath}`);
    }

    if (!templateExists(absolute)) {
      fail(`${context} template not found: ${absolute}`);
    }
  }

  function assertTarget(target: string | undefined, context: string) {
    if (!isSafeRelativePath(target)) {
      fail(`${context} target path '${target}' is invalid.`);
    }

    // Non-null: isSafeRelativePath refused anything but a non-empty string.
    const safeTarget = target!;
    if (targets.has(safeTarget)) {
      fail(`Duplicate target path detected: '${target}'.`);
    }

    targets.add(safeTarget);
  }

  for (const fileDef of outputs.files) {
    if (!fileDef || typeof fileDef !== "object") {
      fail("outputs.files entries must be objects.");
    }

    if (!fileDef.target || !fileDef.template) {
      fail("Each outputs.files entry requires target and template.");
    }

    assertTarget(fileDef.target, "outputs.files");
    assertTemplateExists(fileDef.template, `outputs.files target '${fileDef.target}'`);
  }

  if (!pack.rules || !pack.rules.traceability || !pack.rules.traceability.target) {
    fail("rules.traceability.target is required.");
  }

  if (!isSafeRelativePath(pack.rules.traceability.target)) {
    fail("rules.traceability.target must be a safe relative path.");
  }

  if (pack.schema_version !== undefined && typeof pack.schema_version !== "string") {
    fail("schema_version must be a string when provided.");
  }
  // Forward-compatibility gate. Until now `schema_version` was written by
  // `pack init` and read by nothing, so a pack authored against a newer schema
  // failed later with "unknown property X" — accurate but useless. The schema
  // sets additionalProperties:false, so a newer minor is genuinely unreadable
  // here, not merely unfamiliar; say so at the top rather than field by field.
  if (
    typeof pack.schema_version === "string" &&
    isNewerThan(pack.schema_version, PACK_SCHEMA_VERSION)
  ) {
    fail(
      `pack.yaml declares schema_version ${pack.schema_version}, but this CLI ` +
        `understands up to ${PACK_SCHEMA_VERSION}.\n` +
        "Fix: upgrade with `npm install -g create-spec-driven-app@latest`, or " +
        "pin the pack to a version that targets the older schema."
    );
  }

  for (const item of Array.isArray(pack.requirements) ? pack.requirements : []) {
    remember("requirements", item, "requirement");
    if (item.priority !== undefined && !ALLOWED_PRIORITIES.has(item.priority)) {
      fail(`Requirement '${item.id}' has invalid priority '${item.priority}'.`);
    }
    assertStatus(item.status, `Requirement '${item.id}'`);
  }

  for (const item of Array.isArray(pack.bounded_contexts) ? pack.bounded_contexts : []) {
    remember("bounded_contexts", item, "bounded context");
  }

  // Invariants the domain imposes, independent of any implementation. They
  // live under `business_rules` because `rules` is render configuration —
  // conflating the two is what left every curated pack unable to install.
  for (const item of Array.isArray(pack.business_rules) ? pack.business_rules : []) {
    remember("business_rules", item, "business rule");
    if (!item.title || typeof item.title !== "string") {
      fail(`Business rule '${item.id}' requires a title.`);
    }
  }

  for (const item of Array.isArray(pack.commands) ? pack.commands : []) {
    remember("commands", item, "command");
  }

  for (const item of Array.isArray(pack.queries) ? pack.queries : []) {
    remember("queries", item, "query");
  }

  // `depends_on` (B1): which requirements must land before this one, so the
  // harness can stack a dependent's branch on its predecessor's instead of on
  // the run's base. Checked here rather than at run time — a dependency naming
  // nothing is a defect in the pack, and `runLevels` finding out mid-run means
  // the pack is already installed and an agent already paid for.
  const requirementIds = new Set(
    (Array.isArray(pack.requirements) ? pack.requirements : [])
      .map((r: PackItem) => r && r.id)
      .filter(Boolean)
  );
  const dependsOn = new Map<string, string[]>();
  for (const item of Array.isArray(pack.requirements) ? pack.requirements : []) {
    const declared = asArray(item.depends_on).map((d) => String(d));
    if (declared.length === 0) continue;
    for (const dep of declared) {
      if (dep === item.id) {
        fail(`Requirement '${item.id}' depends on itself.`);
      } else if (!requirementIds.has(dep)) {
        fail(`Requirement '${item.id}' depends on unknown requirement '${dep}'.`);
      }
    }
    // Non-null: `remember` above refused every requirement without a string id.
    dependsOn.set(item.id!, declared);
  }
  assertNoDependencyCycle(dependsOn, fail);

  for (const item of Array.isArray(pack.aggregates) ? pack.aggregates : []) {
    remember("aggregates", item, "aggregate");
  }

  for (const item of Array.isArray(pack.events) ? pack.events : []) {
    remember("events", item, "event");
  }

  for (const item of Array.isArray(pack.value_objects) ? pack.value_objects : []) {
    remember("value_objects", item, "value object");
  }

  for (const context of Array.isArray(pack.bounded_contexts) ? pack.bounded_contexts : []) {
    assertRefs("aggregates", context.aggregates, `Bounded context '${context.id}'`);
  }

  for (const aggregate of Array.isArray(pack.aggregates) ? pack.aggregates : []) {
    // `bounded_context` first: it is what every shipped pack writes, while the
    // published schema said `context`. Reading only `context` made this check
    // inert on all eleven of them — `assertRef` returns early on an empty
    // reference, so an aggregate pointing at a context that does not exist
    // passed the installer in silence. `pack lint` has its own check and caught
    // it, which is why the dead one went unnoticed: two validators disagreeing,
    // and the quiet one trusted.
    //
    // Both spellings are honoured. A pack authored against the published schema
    // must not lose the check either.
    assertRef(
      "bounded_contexts",
      aggregate.bounded_context ?? aggregate.context,
      `Aggregate '${aggregate.id}'`
    );
  }

  for (const useCase of Array.isArray(pack.use_cases) ? pack.use_cases : []) {
    remember("use_cases", useCase, "use case");
    assertRef("requirements", useCase.requirement, `Use case '${useCase.id}'`);
    assertRef("commands", useCase.command, `Use case '${useCase.id}'`);
    assertRef("queries", useCase.query, `Use case '${useCase.id}'`);
    assertRef("aggregates", useCase.aggregate, `Use case '${useCase.id}'`);
    assertRefs("events", useCase.emits, `Use case '${useCase.id}'`);
    assertStatus(useCase.status, `Use case '${useCase.id}'`);
  }

  const scenarios = Array.isArray(pack.scenarios) ? pack.scenarios : [];
  const scenarioIds = new Set();
  for (const scenario of scenarios) {
    if (!scenario || typeof scenario !== "object") {
      fail("scenarios entries must be objects.");
    }

    // The installer's minimum: enough to render the feature file and write the
    // traceability row. Domain linkage (use_case, command, aggregate, events)
    // is optional, so a pack for a domain without CQRS is not forced to invent
    // one — but it is validated below when present.
    const requiredScenarioFields = [
      "id",
      "requirement_id",
      "target",
      "template",
      "feature",
      "scenario",
    ];

    for (const field of requiredScenarioFields) {
      if (!scenario[field] || typeof scenario[field] !== "string") {
        fail(`Scenario is missing required field '${field}'.`);
      }
    }

    if (scenarioIds.has(scenario.id)) {
      fail(`Duplicate scenario id detected: '${scenario.id}'.`);
    }
    scenarioIds.add(scenario.id);

    // Optional by design: a pack author describes the domain, not the caller's
    // implementation. Absent, the matrix renders TBD in that column — which is
    // exactly the gap `plan` reads as NEEDS_IMPLEMENTATION. Validated when it
    // is there, so a typo does not become a silent empty cell.
    if (scenario.technical_artifacts !== undefined) {
      if (
        !Array.isArray(scenario.technical_artifacts) ||
        scenario.technical_artifacts.length === 0
      ) {
        fail(`Scenario '${scenario.id}' has an empty or malformed technical_artifacts.`);
      }
    }
    if (
      scenario.technical_artifact !== undefined &&
      typeof scenario.technical_artifact !== "string"
    ) {
      fail(`Scenario '${scenario.id}' has a malformed technical_artifact.`);
    }

    if (scenario.seed !== undefined && typeof scenario.seed !== "boolean") {
      fail(`Scenario '${scenario.id}' has invalid 'seed' value. Expected boolean.`);
    }

    assertStatus(scenario.status, `Scenario '${scenario.id}'`);
    assertRef("requirements", scenario.requirement_id, `Scenario '${scenario.id}'`);
    assertRef("use_cases", scenario.use_case, `Scenario '${scenario.id}'`);
    assertRef("commands", scenario.command, `Scenario '${scenario.id}'`);
    assertRef("queries", scenario.query, `Scenario '${scenario.id}'`);
    assertRef("aggregates", scenario.aggregate, `Scenario '${scenario.id}'`);
    assertRefs("events", scenario.events, `Scenario '${scenario.id}'`);

    assertTarget(scenario.target, `scenario '${scenario.id}'`);
    assertTemplateExists(scenario.template, `scenario '${scenario.id}'`);
  }

  return {
    requiredVars,
  };
}
export function renderTemplate(content: string, vars: Record<string, unknown>): string {
  return content.replace(/{{([A-Z][A-Z0-9_]*)}}/g, (_, token: string) => {
    if (!(token in vars)) {
      fail(`Missing variable '${token}' required by template.`);
    }
    return String(vars[token]);
  });
}

export function normalizeVars(
  requiredVars: string[],
  providedVars: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = { ...providedVars };

  for (const name of requiredVars) {
    if (!(name in normalized) || normalized[name] === "") {
      fail(`Missing required variable '${name}'. Provide it using --var ${name}=...`);
    }
  }

  return normalized;
}
