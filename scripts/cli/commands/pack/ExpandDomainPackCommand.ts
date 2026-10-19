import * as fs from "node:fs";
import * as path from "node:path";
import {
  asArray,
  entityLabel,
  formatList,
  hasStructuredDomainModel,
  normalizeVars,
  renderTemplate,
  sectionItems,
} from "../../../../packages/core/src/domain/PackSpec";
import type { PackItem } from "../../../../packages/core/src/domain/PackSpec";
import {
  buildTraceabilityMarkdown,
  parseTraceabilityRows,
} from "../../../../packages/core/src/domain/TraceabilityFormat";
import type { MatrixRow } from "../../../../packages/core/src/domain/TraceabilityFormat";
import {
  ensureProjectDir,
  getWrittenFiles,
  loadPack,
  readTemplate,
  resetWrittenFiles,
  safeResolve,
  validatePackModel,
  writeFile,
} from "../../../../packages/core/src/infrastructure/DiskPackRepository";
import { logError, logInfo } from "../../../../packages/core/src/infrastructure/ConsoleReporter";
import { hasScenario, tagScenario } from "../../../../packages/core/src/domain/GherkinTags";
import { appendRequirementSection } from "../../../../packages/core/src/domain/SpecSections";
import { parseArgs } from "./pack-args";
import type { PackArgs } from "./pack-args";
import { resolveRemotePack } from "../../../../packages/core/src/infrastructure/RemotePackResolver";
import { readLock, writeLock, upsertPackEntry, newLock } from "../../../specops/lock";
import {
  computePackDigest,
  readSecurityPolicy,
  verifyTagSignature,
  assertDigestUnchanged,
} from "../../../specops/verify";
import { snapshotBaseline } from "../../../specops/manifest";
import { BaseCommand } from "../../../lib/command";
import { errorMessage } from "../../../lib/diagnostics";

import { findCliRoot } from "../../../lib/project-root";
import { writeRequirementFields } from "../../../lib/derived-writes";
import { mergeCatalog } from "../../../../packages/core/src/domain/CatalogMerge";
import { refreshDerivedMatrix } from "../spec/MatrixCommand";

const PACKAGE_VERSION = (() => {
  try {
    return require(path.join(findCliRoot(__dirname), "package.json")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

// ── What expand reads out of pack.yaml ───────────────────────────────────────
//
// `validatePackModel` checks the parts expand depends on before anything is
// rendered; the catalog sections are read loosely, printing `-` for a field a
// pack leaves out. `schemas/pack.schema.json` is the full format (ADR-0020).

/** A pack.yaml once `validatePackModel` has passed. */
export interface ExpandPack {
  outputs: { files: Array<{ template: string; target: string }> };
  scenarios?: PackScenario[];
  rules: {
    traceability: { target: string; include_existing_rows?: boolean; default_status?: string };
  };
  [section: string]: unknown;
}

/** A `scenarios` entry; the first six fields are required by validation. */
export interface PackScenario {
  id: string;
  requirement_id: string;
  target: string;
  template: string;
  feature: string;
  scenario: string;
  seed?: boolean;
  use_case?: string;
  command?: string;
  query?: string;
  aggregate?: string;
  events?: string | string[];
  status?: string;
  technical_artifact?: string;
  technical_artifacts?: string[];
  test_artifact?: string;
  test_artifacts?: string[];
}

/** Anything a reference can point at: by id, or by name. */
/** Any pack entry that has an id or a name; the rest is the section's own. */
type NamedEntry = PackItem;

interface RequirementEntry extends NamedEntry {
  title?: string;
  description?: string;
  status?: string;
  depends_on?: string | string[];
}

interface BoundedContextEntry extends NamedEntry {
  type?: string;
  responsibility?: string;
  aggregates?: string | string[];
}

interface AggregateEntry extends NamedEntry {
  bounded_context?: string;
  context?: string;
  responsibilities?: unknown;
  invariants?: unknown;
  commands?: unknown;
  queries?: unknown;
}

interface ValueObjectEntry extends NamedEntry {
  fields?: unknown;
  invariants?: unknown;
}

interface EventEntry extends NamedEntry {
  producer?: string;
  aggregate?: string;
  consumers?: unknown;
  payload?: unknown;
}

interface UseCaseEntry extends NamedEntry {
  actor?: string;
  requirement?: string;
  command?: string;
  query?: string;
  aggregate?: string;
  emits?: string | string[];
  status?: string;
}

/** A `commands` or `queries` entry. */
interface OperationEntry extends NamedEntry {
  use_case?: string;
  useCase?: string;
  fields?: unknown;
  returns?: unknown;
}

/** Where the pack came from: a local root, or a pinned remote. */
export interface PackSource {
  packRoot: string;
  remote: RemotePack | null;
}

/** A pack resolved from a git repository at a pinned version. */
export interface RemotePack {
  repo: string;
  version: string;
  commit: string;
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate expand --pack-root <path> --pack <domain/type> --project-dir <path> [--var KEY=VALUE]... [--dry-run] [--no-examples]\n" +
      "  specgate expand --pack-repo <git-url> --pack-version <tag> --pack <pack-id> --project-dir <path> [--var KEY=VALUE]... [--cache-dir <path>] [--dry-run]\n\n" +
      "Examples:\n" +
      '  specgate expand --pack-root ./domain-packs --pack parking-management/backend --project-dir ./projects/smart-parking --var PROJECT_NAME="Smart Parking" --var PROJECT_SLUG=smart-parking --var DOMAIN="parking operations"\n' +
      '  specgate expand --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git --pack-version v0.1.0 --pack backend --project-dir ./smart-parking --var PROJECT_NAME="Smart Parking" --var PROJECT_SLUG=smart-parking --var DOMAIN="parking operations"\n'
  );
}

export function renderStaticFiles(
  pack: ExpandPack,
  packRoot: string,
  projectDir: string,
  vars: Record<string, string>,
  dryRun: boolean
): void {
  for (const fileDef of pack.outputs.files) {
    const template = readTemplate(packRoot, fileDef.template);
    const rendered = renderTemplate(template, vars);
    const target = safeResolve(projectDir, fileDef.target);
    writeFile(target, `${rendered.trimEnd()}\n`, dryRun);
  }
}

export function renderScenarios(
  pack: ExpandPack,
  packRoot: string,
  projectDir: string,
  vars: Record<string, string>,
  dryRun: boolean,
  noExamples?: boolean
): PackScenario[] {
  const generated: PackScenario[] = [];

  for (const scenario of pack.scenarios || []) {
    const isSeed = scenario.seed !== false;
    if (noExamples && isSeed) {
      logInfo(`[skip] seeded scenario '${scenario.id}' due to --no-examples`);
      continue;
    }

    const template = readTemplate(packRoot, scenario.template);
    const rendered = renderTemplate(template, vars);

    // F4: link the matrix row to the scenario the way Cucumber understands.
    // Nobody writes these by hand — and a tag survives a rename, which is what
    // makes `--tags "@REQ-001"` a filter an agent cannot defeat by rewording a
    // title. Idempotent: `expand` runs more than once on the same project.
    const tags = [scenario.requirement_id, scenario.id].filter(Boolean).map((id) => `@${id}`);
    const tagged = tagScenario(rendered, scenario.scenario, tags);
    // Unchanged output means either the scenario is missing or its tags were
    // already there — a template that ships tagged is fine, not an error.
    if (tags.length > 0 && tagged === rendered && !hasScenario(rendered, scenario.scenario)) {
      logError(
        `Scenario '${scenario.id}' declares "${scenario.scenario}", which is not in ` +
          `${scenario.template} — it goes out untagged, and the matrix will point at ` +
          `a scenario that is not there.`
      );
    }

    const target = safeResolve(projectDir, scenario.target);
    writeFile(target, `${tagged.trimEnd()}\n`, dryRun);

    generated.push(scenario);
  }

  return generated;
}

function indexDomainItems<T extends NamedEntry>(pack: ExpandPack, key: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of Array.isArray(pack[key]) ? pack[key] : []) {
    if (item.id) map.set(item.id, item);
    if (item.name) map.set(item.name, item);
  }
  return map;
}

function firstRef(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function resolveLabel(map: Map<string, NamedEntry>, ref: unknown, fallback = "-"): string {
  if (!ref) return fallback;
  return entityLabel(map.get(String(ref)), String(ref));
}

function renderMarkdownTable(headers: string[], rows: string[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

export function renderDomainDocs(pack: ExpandPack, projectDir: string, dryRun: boolean): void {
  if (!hasStructuredDomainModel(pack)) {
    return;
  }

  const boundedContexts: BoundedContextEntry[] = Array.isArray(pack.bounded_contexts)
    ? pack.bounded_contexts
    : [];
  const aggregates: AggregateEntry[] = Array.isArray(pack.aggregates) ? pack.aggregates : [];
  const valueObjects: ValueObjectEntry[] = Array.isArray(pack.value_objects)
    ? pack.value_objects
    : [];
  const events: EventEntry[] = Array.isArray(pack.events) ? pack.events : [];
  const useCases: UseCaseEntry[] = Array.isArray(pack.use_cases) ? pack.use_cases : [];
  const commands: OperationEntry[] = Array.isArray(pack.commands) ? pack.commands : [];
  const queries: OperationEntry[] = Array.isArray(pack.queries) ? pack.queries : [];

  const aggregateIndex = indexDomainItems(pack, "aggregates");
  const commandIndex = indexDomainItems(pack, "commands");
  const queryIndex = indexDomainItems(pack, "queries");
  const eventIndex = indexDomainItems(pack, "events");

  const boundedContextRows = boundedContexts.map((context) => [
    context.id || "-",
    context.name || "-",
    context.type || "-",
    context.responsibility || "-",
    formatList(
      asArray(context.aggregates).map((ref: string) => resolveLabel(aggregateIndex, ref, ref))
    ),
  ]);

  // `bounded_context` first, then `context`: the eleven curated packs write the
  // former and the schema used to say the latter, so reading only `context`
  // rendered an empty column for every one of them. Measured — installing the
  // billing pack produced `| AGG-001 | Invoice | - | - |` while the pack
  // declared both fields under their real names (E1 / H13).
  //
  // Responsibilities and invariants are different things and get their own
  // columns: what an aggregate owns is not the same as the rules it must keep,
  // and showing one under the other's heading would be a mislabelled fact
  // rather than a missing one.
  const aggregateRows = aggregates.map((aggregate) => [
    aggregate.id || "-",
    aggregate.name || "-",
    aggregate.bounded_context || aggregate.context || "-",
    formatList(aggregate.responsibilities),
    formatList(aggregate.invariants),
  ]);

  const valueObjectRows = valueObjects.map((valueObject) => [
    valueObject.id || "-",
    valueObject.name || "-",
    formatList(valueObject.fields),
    formatList(valueObject.invariants),
  ]);

  // The aggregate that emits an event is its producer. The packs say
  // `aggregate:`, the schema said `producer:`, and the renderer read only the
  // latter — so every event in every curated pack rendered `Producer: -`.
  const eventRows = events.map((event) => [
    event.id || "-",
    event.name || "-",
    event.producer || event.aggregate || "-",
    formatList(event.consumers),
    formatList(event.payload),
  ]);

  const useCaseRows = useCases.map((useCase) => {
    const commandOrQuery = firstRef(useCase.command, useCase.query);
    const commandOrQueryLabel = useCase.command
      ? resolveLabel(commandIndex, useCase.command, useCase.command)
      : resolveLabel(queryIndex, useCase.query, commandOrQuery || "-");

    return [
      useCase.id || "-",
      useCase.name || "-",
      useCase.actor || "-",
      useCase.requirement || "-",
      commandOrQueryLabel,
      useCase.aggregate || "-",
      formatList(asArray(useCase.emits).map((ref: string) => resolveLabel(eventIndex, ref, ref))),
      useCase.status || "Draft",
    ];
  });

  const commandRows = commands.map((command) => [
    command.id || "-",
    command.name || "-",
    command.use_case || command.useCase || "-",
    formatList(command.fields),
  ]);

  const queryRows = queries.map((query) => [
    query.id || "-",
    query.name || "-",
    query.use_case || query.useCase || "-",
    formatList(query.returns || query.fields),
  ]);

  const docs = new Map([
    [
      "docs/specs/domain-model.md",
      [
        "# Domain Model",
        "",
        "## Bounded Contexts",
        "",
        renderMarkdownTable(
          ["ID", "Name", "Type", "Responsibility", "Aggregates"],
          boundedContextRows
        ),
        "",
        "## Aggregates",
        "",
        renderMarkdownTable(
          ["ID", "Aggregate", "Context", "Responsibilities", "Invariants"],
          aggregateRows
        ),
        "",
        "## Value Objects",
        "",
        renderMarkdownTable(["ID", "Value Object", "Fields", "Invariants"], valueObjectRows),
        "",
        "## Domain Events",
        "",
        renderMarkdownTable(["ID", "Event", "Producer", "Consumers", "Payload"], eventRows),
        "",
      ].join("\n"),
    ],
    [
      "docs/specs/use-cases.md",
      [
        "# Use Cases",
        "",
        renderMarkdownTable(
          [
            "ID",
            "Use Case",
            "Actor",
            "Requirement",
            "Command/Query",
            "Aggregate",
            "Emits",
            "Status",
          ],
          useCaseRows
        ),
        "",
      ].join("\n"),
    ],
    [
      "docs/specs/commands.md",
      [
        "# Commands and Queries",
        "",
        "## Commands",
        "",
        renderMarkdownTable(["ID", "Command", "Use Case", "Fields"], commandRows),
        "",
        "## Queries",
        "",
        renderMarkdownTable(["ID", "Query", "Use Case", "Returns"], queryRows),
        "",
      ].join("\n"),
    ],
    [
      "docs/specs/events.md",
      [
        "# Domain Events",
        "",
        renderMarkdownTable(["ID", "Event", "Producer", "Consumers", "Payload"], eventRows),
        "",
      ].join("\n"),
    ],
    [
      "docs/specs/aggregates.md",
      [
        "# Aggregates",
        "",
        renderMarkdownTable(
          ["ID", "Aggregate", "Context", "Responsibilities", "Invariants"],
          aggregateRows
        ),
        "",
      ].join("\n"),
    ],
  ]);

  // Shared by every pack in the project: this pack's rows join the rows other
  // packs wrote instead of replacing the file (golden_app finding #22).
  for (const [target, content] of docs.entries()) {
    const file = safeResolve(projectDir, target);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    writeFile(file, mergeCatalog(existing, content), dryRun);
  }
}

/**
 * The bounded context a scenario belongs to, worked out from the pack model.
 *
 * A scenario rarely names an aggregate — none of the twenty-seven across the
 * curated packs does — but it names a use case, the use case names a command,
 * and an aggregate lists the commands it owns. That chain resolves for all of
 * them, which is what makes matching an agent profile on bounded context (D1)
 * useful rather than a rule that never fires.
 *
 * Returns "" when the pack does not carry enough to place it, which is a fact
 * about the pack rather than an error.
 */
function boundedContextOf(
  pack: ExpandPack,
  aggregateRef: string,
  commandRef: string,
  queryRef: string
): string {
  const aggregates = sectionItems<AggregateEntry>(pack.aggregates);
  const contexts = sectionItems<BoundedContextEntry>(pack.bounded_contexts);

  // The **name**, not the id. `match: { bounded_context: Invoicing }` is what a
  // person writes; `BC-001` is an identifier they never chose and would have to
  // look up. Falls back to whatever the aggregate points at when the context is
  // not declared.
  const contextOf = (aggregate: AggregateEntry | undefined) => {
    const ref = String((aggregate && (aggregate.bounded_context || aggregate.context)) || "");
    if (!ref) return "";
    const declared = contexts.find((c) => c && (c.id === ref || c.name === ref));
    return String((declared && declared.name) || ref);
  };

  const named = aggregates.find((a) => a && (a.id === aggregateRef || a.name === aggregateRef));
  if (named) return contextOf(named);

  for (const ref of [commandRef, queryRef]) {
    if (!ref) continue;
    const owner = aggregates.find((a) =>
      asArray(a && a.commands)
        .concat(asArray(a && a.queries))
        .some((c: unknown) => String(c) === String(ref))
    );
    if (owner) return contextOf(owner);
  }
  return "";
}

export function renderTraceability(
  pack: ExpandPack,
  projectDir: string,
  generatedScenarios: PackScenario[],
  dryRun: boolean
): void {
  const traceTarget = safeResolve(projectDir, pack.rules.traceability.target);

  let rows: MatrixRow[] = [];
  let mode = hasStructuredDomainModel(pack) ? "rich" : "legacy";
  const includeExisting = pack.rules.traceability.include_existing_rows !== false;
  if (includeExisting && fs.existsSync(traceTarget)) {
    const parsed = parseTraceabilityRows(fs.readFileSync(traceTarget, "utf8"));
    rows = parsed.rows;
    if (parsed.mode === "rich") {
      mode = "rich";
    }
  }

  if (mode === "rich") {
    rows = rows.map((row) => {
      if (!row.feature) return row;
      return {
        requirement: "-",
        scenarioId: "-",
        featureFile: row.feature,
        useCase: "-",
        commandOrQuery: "-",
        aggregate: "-",
        event: "-",
        technicalArtifact: row.technicalArtifact,
        testArtifact: "-",
        status: row.status || "Draft",
      };
    });
  }

  const requirements = indexDomainItems<RequirementEntry>(pack, "requirements");
  const useCases = indexDomainItems<UseCaseEntry>(pack, "use_cases");
  const commands = indexDomainItems<OperationEntry>(pack, "commands");
  const queries = indexDomainItems<OperationEntry>(pack, "queries");
  const aggregates = indexDomainItems<AggregateEntry>(pack, "aggregates");
  const events = indexDomainItems<EventEntry>(pack, "events");

  const rowKeys = new Set(
    rows.map((row) => {
      if (mode === "rich") return `${row.featureFile}::${row.scenarioId}`;
      return `${row.feature}::${row.scenario}`;
    })
  );

  for (const scenario of generatedScenarios) {
    const featureCell = `\`${scenario.target}\``;
    const statusCell = scenario.status || pack.rules.traceability.default_status || "Draft";

    if (mode === "rich") {
      // An absent `use_case` finds nothing: no entry is keyed by undefined.
      const useCase = useCases.get(scenario.use_case as string);
      const commandRef = firstRef(scenario.command, useCase && useCase.command);
      const queryRef = firstRef(scenario.query, useCase && useCase.query);
      const aggregateRef = firstRef(scenario.aggregate, useCase && useCase.aggregate);
      const requirementRef = firstRef(scenario.requirement_id, useCase && useCase.requirement);
      const eventRefs =
        asArray(scenario.events).length > 0
          ? asArray(scenario.events)
          : asArray(useCase && useCase.emits);

      // B1: the requirement's `depends_on`, carried to the matrix so `plan` and
      // the harness can see it. The pack is where a pack author declares it;
      // the matrix is where the project reads it back.
      const requirementItem = requirements.get(requirementRef);

      // D1: which bounded context this requirement belongs to, so a per-context
      // agent profile can match it. Derived rather than declared — measured
      // across the curated packs, no scenario links to an aggregate directly
      // (0 of 27), but use case → command → aggregate → bounded context
      // resolves for every one of them.
      const contextRef = boundedContextOf(pack, aggregateRef, commandRef, queryRef);
      const row: MatrixRow = {
        dependsOn: asArray(requirementItem && requirementItem.depends_on).map((d: unknown) =>
          String(d)
        ),
        context: contextRef,
        requirement: resolveLabel(requirements, requirementRef, requirementRef || "-"),
        scenarioId: scenario.id,
        featureFile: featureCell,
        useCase: entityLabel(useCase, scenario.use_case || "-"),
        commandOrQuery: commandRef
          ? resolveLabel(commands, commandRef, commandRef)
          : resolveLabel(queries, queryRef, queryRef || "-"),
        aggregate: resolveLabel(aggregates, aggregateRef, aggregateRef || "-"),
        event: formatList(eventRefs.map((ref: string) => resolveLabel(events, ref, ref))),
        technicalArtifact: formatList(scenario.technical_artifacts || scenario.technical_artifact),
        testArtifact: formatList(scenario.test_artifacts || scenario.test_artifact, "TBD"),
        status: statusCell,
      };

      const key = `${row.featureFile}::${row.scenarioId}`;
      if (!rowKeys.has(key)) {
        rows.push(row);
        rowKeys.add(key);
      }
      continue;
    }

    const row = {
      feature: featureCell,
      scenario: scenario.scenario,
      technicalArtifact: formatList(scenario.technical_artifact || scenario.technical_artifacts),
      status: statusCell,
    };

    const key = `${row.feature}::${row.scenario}`;
    if (!rowKeys.has(key)) {
      rows.push(row);
      rowKeys.add(key);
    }
  }

  // A requirement the pack declares without a scenario yet still belongs in
  // the matrix, as Draft with no scenario: rows were only written per
  // scenario, so `validate --against-lock` failed a freshly installed pack
  // with `pack_requirement_missing`, and the `specops sync` it suggested
  // re-expanded the same matrix. Found by the E2E packs journey on the
  // multi-tenant pack, whose REQ-004 has a use case and no scenario.
  if (mode === "rich") {
    const bareId = (v: unknown) =>
      String(v || "")
        .replace(/`/g, "")
        .trim();
    const represented = new Set(rows.map((r) => bareId(r.requirement)));
    const defaultStatus =
      (pack.rules && pack.rules.traceability && pack.rules.traceability.default_status) || "Draft";
    const declared: RequirementEntry[] = Array.isArray(pack.requirements) ? pack.requirements : [];
    const declaredUseCases: UseCaseEntry[] = Array.isArray(pack.use_cases) ? pack.use_cases : [];
    for (const item of declared) {
      if (!item || !item.id || represented.has(String(item.id))) continue;
      const useCase = declaredUseCases.find((u) => String(u.requirement) === String(item.id));
      rows.push({
        dependsOn: asArray(item.depends_on).map((d: unknown) => String(d)),
        requirement: resolveLabel(requirements, item.id, item.id),
        scenarioId: "-",
        featureFile: "-",
        useCase: useCase ? entityLabel(useCase, useCase.id || "-") : "-",
        commandOrQuery:
          useCase && useCase.command
            ? resolveLabel(commands, useCase.command, useCase.command)
            : "-",
        aggregate: "-",
        event: "-",
        technicalArtifact: "-",
        testArtifact: "TBD",
        status: item.status || defaultStatus,
      });
      represented.add(String(item.id));
    }
  }

  if (
    mode === "rich" &&
    fs.existsSync(traceTarget) &&
    fs.readFileSync(traceTarget, "utf8").includes("<!-- specgate:derived")
  ) {
    // A generated matrix stays generated. Each requirement's use case,
    // command, aggregate, event and context go into the specgate:trace comment of
    // its section — the capability spec the pack wrote, or a new section in
    // spec.md carrying the pack's own prose — and the matrix is regenerated,
    // one row per tagged scenario. Writing rows here instead turned the
    // project back into a hand-kept matrix, which then refused a requirement
    // with two scenarios and left spec.md with placeholder sections.
    if (!dryRun) writeDerivedRequirements(projectDir, rows, pack);
    return;
  }

  const markdown = buildTraceabilityMarkdown(rows, mode);
  writeFile(traceTarget, markdown, dryRun);
}

/**
 * The derived half of `renderTraceability`: the pack's rows become trace
 * fields on the requirement they belong to.
 */
function writeDerivedRequirements(projectDir: string, rows: MatrixRow[], pack: ExpandPack) {
  const bare = (v: unknown) =>
    String(v || "")
      .replace(/`/g, "")
      .trim();
  const idOf = (label: unknown) => (/^(REQ-\d+)/.exec(bare(label)) || [])[1] || "";
  const titleOf = (label: unknown) => bare(label).replace(/^REQ-\d+\s*[—-]?\s*/, "");
  const specFile = path.join(projectDir, "spec.md");

  const seen = new Set<string>();
  for (const row of rows) {
    const id = idOf(row.requirement);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const fields: Record<string, string> = {};
    const put = (key: string, value: unknown) => {
      const v = bare(value);
      if (v && v !== "-") fields[key] = v;
    };
    put("uc", row.useCase);
    put("cmd", row.commandOrQuery);
    put("agg", row.aggregate);
    put("evt", row.event);
    put("context", row.context);
    if (Array.isArray(row.dependsOn) && row.dependsOn.length > 0)
      fields.depends = row.dependsOn.join(",");

    if (writeRequirementFields(projectDir, id, fields) === null) {
      // No section anywhere yet: write one in spec.md with the pack's title,
      // then record the fields on it.
      const current = fs.existsSync(specFile) ? fs.readFileSync(specFile, "utf8") : "";
      const declared: RequirementEntry[] = Array.isArray(pack.requirements)
        ? pack.requirements
        : [];
      const item = declared.find((r) => String(r.id) === id);
      const title = (item && item.title) || titleOf(row.requirement) || id;
      const { content } = appendRequirementSection(current, id, title);
      // The pack's own description, not the placeholder a bare `req add` writes.
      const withProse =
        item && item.description
          ? content.replace(
              /The system MUST satisfy: [^\n]*\n(\n> Written by [^\n]*\n)?$/,
              `${String(item.description).trim()}\n`
            )
          : content;
      fs.writeFileSync(specFile, withProse, "utf8");
      writeRequirementFields(projectDir, id, fields);
    }
  }
  refreshDerivedMatrix(projectDir);
}

export function resolvePackSource(args: PackArgs): PackSource {
  const hasRemote = Boolean(args.packRepo);
  const hasLocal = Boolean(args.packRoot);

  if (hasRemote && hasLocal) {
    throw new Error("Specify either --pack-root or --pack-repo, not both.");
  }

  if (hasRemote) {
    if (!args.packVersion) {
      throw new Error("--pack-repo requires --pack-version <tag-or-sha> for reproducibility.");
    }
    logInfo(`Resolving remote pack ${args.packRepo}@${args.packVersion}…`);
    const resolved = resolveRemotePack({
      repo: args.packRepo,
      version: args.packVersion,
      cacheDir: args.cacheDir || undefined,
    });
    logInfo(
      `${resolved.cached ? "Reused cached" : "Cloned"} pack at ${resolved.packRoot} ` +
        `(commit ${resolved.commit.slice(0, 7)})`
    );
    return {
      packRoot: resolved.packRoot,
      remote: {
        repo: args.packRepo,
        version: args.packVersion,
        commit: resolved.commit,
      },
    };
  }

  return { packRoot: args.packRoot, remote: null };
}

export function enforcePackSecurity(
  projectDir: string,
  packId: string,
  packDir: string,
  source: PackSource
): string {
  const digest = computePackDigest(packDir);
  const { remote } = source;
  if (!remote) return digest;

  const lock = readLock(projectDir);
  const prev = lock && lock.packs.find((p) => p.repo === remote.repo && p.pack_id === packId);
  assertDigestUnchanged(prev, packId, remote.version, digest);

  const policy = readSecurityPolicy(projectDir);
  if (policy.requireSignedPacks) {
    const sig = verifyTagSignature(source.packRoot, remote.version);
    if (!sig.verified) {
      throw new Error(
        `require_signed_packs is enabled but ${remote.repo}@${remote.version} ` +
          "has no valid GPG signature (checked the tag, then the commit).\n" +
          "Fix: have the pack maintainer publish signed tags (git tag -s) and import " +
          "their public key, or disable require_signed_packs in specops.config.yaml."
      );
    }
    logInfo(`Signature verified via git verify-${sig.method} for ${remote.version}.`);
  }
  return digest;
}

export function updateLockfile(
  projectDir: string,
  packId: string,
  remote: RemotePack | null,
  vars: Record<string, string> | null | undefined,
  dryRun: boolean,
  digest: string
): void {
  if (!remote) return;
  const existing = readLock(projectDir) || newLock(PACKAGE_VERSION);
  existing.specgate_version = PACKAGE_VERSION;
  const updated = upsertPackEntry(existing, {
    repo: remote.repo,
    version: remote.version,
    commit: remote.commit,
    digest,
    pack_id: packId,
    expanded_at: new Date().toISOString(),
    vars: { ...(vars || {}) },
  });
  const result = writeLock(projectDir, updated, { dryRun });
  logInfo(`${dryRun ? "[dry-run] would write" : "Wrote"} ${result.path}`);
}

export function updateBaseline(
  projectDir: string,
  packId: string,
  remote: RemotePack | null,
  dryRun: boolean
): void {
  if (!remote) return;
  const entries = getWrittenFiles().map((written) => ({
    rel: path.relative(projectDir, written.file).split(path.sep).join("/"),
    content: written.content,
  }));
  const result = snapshotBaseline(
    projectDir,
    packId,
    entries,
    { version: remote.version },
    { dryRun }
  );
  if (result.written) {
    logInfo(`Recorded baseline for ${result.count} file(s) under .specops/baseline/${packId}`);
  }
}

export class ExpandDomainPackCommand extends BaseCommand {
  public execute(): void {
    try {
      const rawArgs = this.args[0] === "expand" ? this.args.slice(1) : this.args;
      if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
        usage();
        process.exit(0);
      }
      const args = parseArgs(rawArgs);

      if (!args.pack || !args.projectDir) {
        usage();
        process.exit(2);
      }
      if (!args.packRoot && !args.packRepo) {
        usage();
        process.exit(2);
      }

      const source = resolvePackSource(args);
      const loaded = loadPack(source.packRoot, args.pack);
      const { packRoot, packFile } = loaded;
      const { requiredVars } = validatePackModel(loaded.pack, packRoot);
      // Validated just above: the sections expand renders have the shape it reads.
      const pack = loaded.pack as ExpandPack;
      const vars = normalizeVars(requiredVars, args.vars);

      ensureProjectDir(args.projectDir, args.dryRun);

      const digest = enforcePackSecurity(args.projectDir, args.pack, packRoot, source);

      logInfo(`Using pack: ${packFile}`);
      resetWrittenFiles();
      renderStaticFiles(pack, packRoot, args.projectDir, vars, args.dryRun);
      const generated = renderScenarios(
        pack,
        packRoot,
        args.projectDir,
        vars,
        args.dryRun,
        args.noExamples
      );
      renderDomainDocs(pack, args.projectDir, args.dryRun);
      renderTraceability(pack, args.projectDir, generated, args.dryRun);
      updateLockfile(args.projectDir, args.pack, source.remote, vars, args.dryRun, digest);
      updateBaseline(args.projectDir, args.pack, source.remote, args.dryRun);

      logInfo(`Generated ${generated.length} scenario file(s).`);
      logInfo("Domain pack expansion completed.");
      process.exit(0);
    } catch (err) {
      logError(errorMessage(err));
      process.exit(1);
    }
  }
}
