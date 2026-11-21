/**
 * Use cases follow the requirements' lifecycle (REQ-625, #543): a change
 * carries `use-cases.md` with what it adds, modifies and removes, a person
 * approves it with the change, and archive merges it into
 * `docs/specs/use-cases.md`. Nobody edits the catalog by hand.
 *
 *   ## ADDED Use Cases
 *   | ID | Use Case | Actor | Requirements |
 *   | --- | --- | --- | --- |
 *   | UC-004 | Create a child profile | Tutor | REQ-012, REQ-013 |
 *
 *   ## MODIFIED Use Cases      (same table: the row as it becomes)
 *   ## REMOVED Use Cases
 *   | ID | Reason |
 *
 * Pure: strings in, strings out.
 */

export interface UseCaseRow {
  id: string;
  name: string;
  actor: string;
  requirements: string[];
}

export interface UseCaseDelta {
  added: UseCaseRow[];
  modified: UseCaseRow[];
  removed: Array<{ id: string; reason: string }>;
  /** `## …` headings the file has that are none of the three. */
  unknownSections: string[];
}

export interface UseCaseFinding {
  code: string;
  message: string;
  fix: string;
  target?: string;
}

const UC_ID = /^UC-\d{3,}$/;
const ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const reqList = (cell: string): string[] =>
  [...cell.matchAll(/\bREQ-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*\b/g)].map((m) => m[0]);

/** The rows of the table under each `## … Use Cases` heading, header and separator left out. */
function tablesBySection(text: string): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  let section: string | null = null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (heading) {
      section = heading[1].toLowerCase();
      if (!out.has(section)) out.set(section, []);
      continue;
    }
    if (!section || !ROW.test(lines[i])) continue;
    if (SEPARATOR.test(lines[i])) continue;
    // The header: the line right before a separator.
    if (i + 1 < lines.length && SEPARATOR.test(lines[i + 1])) continue;
    out.get(section)!.push(cells(lines[i]));
  }
  return out;
}

export function parseUseCaseDelta(text: string): UseCaseDelta {
  const sections = tablesBySection(text);
  const row = (c: string[]): UseCaseRow => ({
    id: c[0] ?? "",
    name: c[1] ?? "",
    actor: c[2] ?? "",
    requirements: reqList(c[3] ?? ""),
  });
  const known = ["added use cases", "modified use cases", "removed use cases"];
  return {
    added: (sections.get("added use cases") ?? []).map(row),
    modified: (sections.get("modified use cases") ?? []).map(row),
    removed: (sections.get("removed use cases") ?? []).map((c) => ({
      id: c[0] ?? "",
      reason: c[1] ?? "",
    })),
    unknownSections: [...sections.keys()].filter((s) => !known.includes(s)),
  };
}

/** A catalog row: `| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |`. */
interface CatalogRow {
  id: string;
  cells: string[];
}

export const CATALOG_HEADER =
  "| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits | Status |";
const CATALOG_SEPARATOR = "|---|---|---|---|---|---|---|---|";

/** The template's placeholder row (`UC-001 Describe the first use case`, `REQ-TBD`). */
export function isTemplateRow(cellsOf: string[]): boolean {
  return (
    /describe the first use case/i.test(cellsOf[1] ?? "") || /\bREQ-TBD\b/.test(cellsOf[3] ?? "")
  );
}

/** The catalog's use cases: id, name, actor, requirements — template rows marked. */
export function readCatalog(
  text: string | null
): Array<UseCaseRow & { template: boolean; status: string }> {
  if (!text) return [];
  const out: Array<UseCaseRow & { template: boolean; status: string }> = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!ROW.test(line) || SEPARATOR.test(line)) continue;
    const c = cells(line);
    if (!UC_ID.test(c[0] ?? "")) continue;
    out.push({
      id: c[0],
      name: c[1] ?? "",
      actor: c[2] ?? "",
      requirements: reqList(c[3] ?? ""),
      template: isTemplateRow(c),
      status: c[7] ?? "",
    });
  }
  return out;
}

/**
 * What is wrong with a change's use cases against the catalog (REQ-625):
 * ids that are no UC id or repeat, an added id the catalog has, a modified or
 * removed id it does not have, a use case with no requirement, and a removed
 * use case some requirement still names (`liveUses`: requirement → use case,
 * after the change's own requirements are applied).
 */
export function checkUseCaseDelta(
  delta: UseCaseDelta,
  catalog: ReadonlyArray<{ id: string; template?: boolean }>,
  liveUses: ReadonlyMap<string, string> = new Map()
): UseCaseFinding[] {
  const out: UseCaseFinding[] = [];
  const inCatalog = new Set(catalog.filter((c) => !c.template).map((c) => c.id));
  const seen = new Set<string>();
  for (const s of delta.unknownSections)
    out.push({
      code: "uc_unknown_section",
      message: `use-cases.md has a section "## ${s}".`,
      fix: "Use ## ADDED Use Cases, ## MODIFIED Use Cases or ## REMOVED Use Cases.",
    });
  const all = [
    ...delta.added.map((r) => ({ op: "added", id: r.id, row: r as UseCaseRow | null })),
    ...delta.modified.map((r) => ({ op: "modified", id: r.id, row: r as UseCaseRow | null })),
    ...delta.removed.map((r) => ({ op: "removed", id: r.id, row: null as UseCaseRow | null })),
  ];
  for (const { op, id, row } of all) {
    if (!UC_ID.test(id)) {
      out.push({
        code: "uc_invalid_id",
        message: `"${id}" is not a use case id.`,
        fix: "Write it as UC-NNN, from the range change.yaml reserves (uc_range).",
        target: id,
      });
      continue;
    }
    if (seen.has(id))
      out.push({
        code: "uc_duplicate",
        message: `${id} appears twice in use-cases.md.`,
        fix: `Keep one row for ${id}.`,
        target: id,
      });
    seen.add(id);
    if (op === "added" && inCatalog.has(id))
      out.push({
        code: "uc_exists",
        message: `${id} is added, and docs/specs/use-cases.md has it already.`,
        fix: `Move it under ## MODIFIED Use Cases, or take a new id from uc_range.`,
        target: id,
      });
    if ((op === "modified" || op === "removed") && !inCatalog.has(id))
      out.push({
        code: "uc_unknown",
        message: `${id} is ${op}, and docs/specs/use-cases.md does not have it.`,
        fix: op === "modified" ? `Add it under ## ADDED Use Cases instead.` : `Drop the row.`,
        target: id,
      });
    if (row && !row.name)
      out.push({
        code: "uc_no_name",
        message: `${id} has no name.`,
        fix: "Name what the actor achieves: Create a child profile.",
        target: id,
      });
    if (row && row.requirements.length === 0)
      out.push({
        code: "uc_no_requirement",
        message: `${id} names no requirement.`,
        fix: `List the requirements that deliver ${id} (REQ-012, REQ-013), each with uc=${id} in its trace.`,
        target: id,
      });
    if (op === "removed") {
      const using = [...liveUses].filter(([, uc]) => uc === id).map(([req]) => req);
      if (using.length)
        out.push({
          code: "uc_removed_in_use",
          message: `${id} is removed, and ${using.join(", ")} still ${using.length === 1 ? "names" : "name"} it.`,
          fix: `In the same change, give ${using.join(", ")} another use case (uc=…) or remove ${using.length === 1 ? "it" : "them"}.`,
          target: id,
        });
    }
  }
  return out;
}

const pad = (row: CatalogRow): string => `| ${row.cells.join(" | ")} |`;

/**
 * `docs/specs/use-cases.md` with a change's use cases merged (REQ-625): an
 * added or modified row replaces the row with its id — keeping what the
 * catalog says of its command, aggregate and events — a removed id is dropped,
 * the template's placeholder row goes once a real use case is there, and rows
 * stay sorted by id. A catalog with no table gets one.
 */
export function applyUseCaseDelta(
  catalog: string | null,
  delta: UseCaseDelta,
  status = "Approved"
): string {
  const text = (catalog ?? "# Use Cases\n").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const header = lines.findIndex((l) => ROW.test(l) && /\|\s*ID\s*\|\s*Use Case\s*\|/i.test(l));
  let start: number;
  let end: number;
  let rows: CatalogRow[];
  if (header >= 0 && SEPARATOR.test(lines[header + 1] ?? "")) {
    start = header;
    end = header + 2;
    while (end < lines.length && ROW.test(lines[end])) end += 1;
    rows = lines.slice(header + 2, end).map((l) => {
      const c = cells(l);
      return { id: c[0] ?? "", cells: c };
    });
  } else {
    start = lines.length;
    end = lines.length;
    rows = [];
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of [...delta.added, ...delta.modified]) {
    const before = byId.get(r.id)?.cells ?? [];
    byId.set(r.id, {
      id: r.id,
      cells: [
        r.id,
        r.name,
        r.actor,
        r.requirements.join(", "),
        before[4] || "-",
        before[5] || "-",
        before[6] || "-",
        status,
      ],
    });
  }
  for (const r of delta.removed) byId.delete(r.id);
  let merged = [...byId.values()];
  if (merged.some((r) => !isTemplateRow(r.cells)))
    merged = merged.filter((r) => !isTemplateRow(r.cells));
  merged.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const table = [CATALOG_HEADER, CATALOG_SEPARATOR, ...merged.map(pad)];
  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const lead =
    start === lines.length && before.length && before[before.length - 1] !== "" ? [""] : [];
  return [...before, ...lead, ...table, ...after].join("\n").replace(/\n*$/, "\n");
}

/** The use cases a new draft's `use-cases.md` starts from: its three sections, empty. */
export function templateUseCases(changeId: string): string {
  return [
    `# Use cases — ${changeId}`,
    "",
    "## ADDED Use Cases",
    "",
    "| ID | Use Case | Actor | Requirements |",
    "| --- | --- | --- | --- |",
    "",
  ].join("\n");
}

/**
 * The gate's `use_cases` rule (REQ-627): every requirement of the matrix
 * names a use case the catalog has, every use case of the catalog is
 * delivered by a requirement, and no template row is left once there is a
 * requirement. `REQ-000`, the health baseline `init` writes, and the adopted
 * code's baseline ("Preserve existing behaviour") are not asked for one. A
 * project with no catalog does not model use cases: nothing to say. The
 * matrix's Use Case cell counts only as `UC-NNN` — the derived matrix writes
 * a requirement's title there when it names none.
 * Pure: the matrix's rows and the catalog in, findings out.
 */
export function useCaseCoverage(
  rows: ReadonlyArray<{ requirement: string; useCase: string }>,
  catalogText: string | null,
  /** The ids under docs/specs/use-cases/ (REQ-633); undefined when not asked. */
  specified?: ReadonlySet<string>
): UseCaseFinding[] {
  const out: UseCaseFinding[] = [];
  if (catalogText === null) return out;
  const catalog = readCatalog(catalogText);
  const real = catalog.filter((c) => !c.template);
  const ids = new Set(real.map((c) => c.id));
  const reqs = new Map<string, string>();
  for (const r of rows) {
    if (!/^REQ-/.test(r.requirement) || r.requirement === "REQ-000") continue;
    if (/preserve existing behaviour/i.test(r.useCase || "")) continue;
    const cell = (r.useCase || "").trim();
    const uc = UC_ID.test(cell) ? cell : "";
    if (!reqs.has(r.requirement) || (uc && uc !== "-")) reqs.set(r.requirement, uc);
  }
  // A requirement a use case of the catalog lists is delivered by it (REQ-636).
  const listedBy = new Map(
    real.flatMap((c) => c.requirements.map((q) => [q, c.id] as [string, string]))
  );
  for (const [req, named] of reqs) {
    const uc = named || listedBy.get(req) || "";
    if (uc && !named) reqs.set(req, uc);
    if (!uc || uc === "-") {
      out.push({
        code: "use_case_missing",
        message: `${req} names no use case.`,
        fix: `Give ${req} its use case: uc=UC-NNN in its specgate:trace, through a change that adds the use case to docs/specs/use-cases.md.`,
        target: req,
      });
    } else if (!ids.has(uc)) {
      out.push({
        code: "use_case_unknown",
        message: `${req} names ${uc}, which docs/specs/use-cases.md does not have.`,
        fix: `Add ${uc} through a change's use-cases.md, or name a use case the catalog has.`,
        target: req,
      });
    }
  }
  const delivered = new Set([...reqs.values()]);
  // REQ-633: every use case of the catalog has its specification.
  if (specified) {
    for (const c of real) {
      if (!specified.has(c.id))
        out.push({
          code: "use_case_no_spec",
          message: `${c.id} (${c.name}) has no specification in docs/specs/use-cases/${c.id}.md.`,
          fix: `Write it through a change: use-cases/${c.id}.md, with ${c.id} under ## MODIFIED Use Cases.`,
          target: c.id,
        });
    }
  }
  for (const c of real) {
    if (!delivered.has(c.id)) {
      out.push({
        code: "use_case_undelivered",
        message: `${c.id} (${c.name}) is delivered by no requirement.`,
        fix: `Name it from a requirement (uc=${c.id}), or remove it through a change's ## REMOVED Use Cases.`,
        target: c.id,
      });
    }
  }
  if (reqs.size > 0 && catalog.some((c) => c.template)) {
    out.push({
      code: "use_case_template",
      message:
        "docs/specs/use-cases.md still holds the template's row (Describe the first use case).",
      fix: "It goes once a change adds a real use case; or write the catalog's first use cases through a change.",
      target: "UC-001",
    });
  }
  return out;
}
