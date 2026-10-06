/**
 * Reading and writing `docs/specs/traceability.md`.
 *
 * The matrix has two shapes: the legacy 4-column form and the rich 10-column
 * form. Both are parsed here and `mode` reports which was found, so callers
 * round-trip a file in the shape it already had instead of silently upgrading
 * it. Pure text-to-rows and rows-to-text; the disk sits behind
 * `ITraceabilityRepository`.
 */

export function parseTraceabilityRows(existingContent) {
  const rows = [];
  const seen = new Set();
  let mode = "legacy";
  // Carried alongside the rows so a rebuild does not drop it — see
  // `parseMatrixDependencies` for why it cannot live in a cell.
  const declaredDependencies = parseMatrixDependencies(existingContent);

  const lines = existingContent.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;

    const cells = trimmed
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells[0] === "Requirement" && cells[1] === "Scenario ID") {
      mode = "rich";
      continue;
    }

    if (cells[0] === "Feature" && cells[1] === "Scenario") {
      continue;
    }

    if (cells.length === 10) {
      mode = "rich";
      const row = {
        requirement: cells[0],
        scenarioId: cells[1],
        featureFile: cells[2],
        useCase: cells[3],
        commandOrQuery: cells[4],
        aggregate: cells[5],
        event: cells[6],
        technicalArtifact: cells[7],
        testArtifact: cells[8],
        status: cells[9],
      };
      // The requirement id is what makes a row a row. Keying on
      // `featureFile::scenarioId` alone meant every proposal `adopt` seeds —
      // which by design has neither yet — hashed to the same `-::-`, so all but
      // the first disappeared from the parse while staying in the file. The
      // allocator then reissued an id that was already taken, and `req link`
      // wrote both rows at once. Three independent cold adoptions on three
      // stacks hit it in the same five minutes of use.
      const key = `${row.requirement}::${row.featureFile}::${row.scenarioId}`;
      if (seen.has(key)) continue;

      seen.add(key);
      rows.push(row);
      continue;
    }

    if (cells.length !== 4) continue;

    const row = {
      feature: cells[0],
      scenario: cells[1],
      technicalArtifact: cells[2],
      status: cells[3],
    };
    const key = `${row.feature}::${row.scenario}`;
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push(row);
  }

  // The dependency lines are read back with the rows so a rebuild carries them
  // forward. Attached to the row as well, because that is what `expand` writes
  // from.
  const declaredContexts = parseMatrixContexts(existingContent);
  for (const row of rows) {
    if (!row.requirement) continue;
    if (declaredDependencies[row.requirement]) {
      row.dependsOn = declaredDependencies[row.requirement];
    }
    if (declaredContexts[row.requirement]) {
      row.context = declaredContexts[row.requirement];
    }
  }

  return { mode, rows, dependsOn: declaredDependencies };
}

/**
 * Requirement dependencies, carried alongside the matrix (B1).
 *
 * The matrix is the one place a pack's requirements land, so it is where a
 * pack's `depends_on` has to arrive. It cannot ride in a cell: the row parser
 * splits on `|` and requires exactly ten cells, so anything appended to a row
 * makes an eleventh and the row stops parsing — the annotation would survive one
 * write and vanish on the next `expand`.
 *
 * So it goes on its own line beneath the table. Lines that do not start with
 * `|` are already ignored by the row parser, which makes the round trip safe by
 * construction rather than by care. `csda:trace` is the extension point this
 * repository already uses for exactly this kind of declaration.
 *
 *     <!-- csda:trace REQ-002 depends=REQ-001 -->
 */
const RE_TRACE_LINE = /^\s*<!--\s*csda:trace\s+(REQ-[A-Za-z0-9.]+)\s+(.+?)\s*-->\s*$/;

/**
 * Every `key=value` a matrix trace line carries, per requirement.
 *
 * One line, several keys: `depends=` came first (B1) and `context=` followed
 * (D1). Keeping the parse general is what stops a third key from arriving as a
 * third regular expression that agrees with the other two by luck.
 */
/** Keys that reach the prototype instead of the object. */
const UNSAFE_KEY = /^(__proto__|constructor|prototype)$/;

export function parseMatrixTraceLines(content: string): Record<string, Record<string, string>> {
  const found: Record<string, Record<string, string>> = Object.create(null);
  for (const line of String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")) {
    const match = RE_TRACE_LINE.exec(line);
    if (!match) continue;
    // `Object.create(null)`: the keys come out of a file, so the object must not
    // have a prototype for them to reach. The name check below says what is
    // refused; this makes the refusal structural.
    const entry = found[match[1]] || (found[match[1]] = Object.create(null));
    // A token with no `=` continues the value before it, so a person who writes
    // `depends=REQ-001, REQ-002` with a space keeps both. Splitting on
    // whitespace alone would drop the second silently, which is the failure
    // mode this repository keeps finding — the value looks written and is not
    // there.
    let key = "";
    for (const token of match[2].split(/\s+/)) {
      const at = token.indexOf("=");
      if (at > 0) {
        // The key comes out of a file, so it is not allowed to be `__proto__`
        // or `constructor`: assigning those reaches the prototype rather than
        // the object. Nothing legitimate is named that, and CodeQL was right to
        // flag it even though the obvious payload happens to be inert.
        const candidate = token.slice(0, at);
        key = UNSAFE_KEY.test(candidate) ? "" : candidate;
        if (key) entry[key] = token.slice(at + 1);
      } else if (key && token) {
        entry[key] = `${entry[key]}${token}`;
      }
    }
  }
  return found;
}

/** Every dependency the matrix declares, requirement to its predecessors. */
export function parseMatrixDependencies(content: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  const traced = parseMatrixTraceLines(content);
  for (const id of Object.keys(traced)) {
    const deps = String(traced[id].depends || "")
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (deps.length > 0) found[id] = deps;
  }
  return found;
}

/**
 * The bounded context each requirement belongs to, as `expand` derived it (D1).
 *
 * Not a column: an eleventh was rejected once already, and the trace line B1
 * introduced is the extension point that exists.
 */
export function parseMatrixContexts(content: string): Record<string, string> {
  const found: Record<string, string> = {};
  const traced = parseMatrixTraceLines(content);
  for (const id of Object.keys(traced)) {
    if (traced[id].context) found[id] = traced[id].context;
  }
  return found;
}

/** The lines above, rendered. Empty when nothing declares a dependency. */
export function renderMatrixTraceLines(
  perRequirement: Record<string, { dependsOn?: string[]; context?: string }>
): string[] {
  const lines: string[] = [];
  for (const id of Object.keys(perRequirement || {}).sort()) {
    const entry = perRequirement[id] || {};
    const parts: string[] = [];
    const deps = (entry.dependsOn || []).filter(Boolean);
    if (deps.length > 0) parts.push(`depends=${deps.join(",")}`);
    if (entry.context) parts.push(`context=${entry.context}`);
    if (parts.length > 0) lines.push(`<!-- csda:trace ${id} ${parts.join(" ")} -->`);
  }
  return lines.length > 0 ? ["", ...lines] : [];
}

export function buildTraceabilityMarkdown(rows, mode = "legacy") {
  if (mode === "rich") {
    const header = [
      "# Traceability Matrix",
      "",
      "Map requirements to scenarios, domain model elements, implementation artifacts, and tests.",
      "",
      "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |",
      "|---|---|---|---|---|---|---|---|---|---|",
    ];

    const body = rows
      .map((row) => [
        row.requirement || "-",
        row.scenarioId || "-",
        row.featureFile || "-",
        row.useCase || "-",
        row.commandOrQuery || "-",
        row.aggregate || "-",
        row.event || "-",
        row.technicalArtifact || "-",
        row.testArtifact || "-",
        row.status || "Draft",
      ])
      .map((cells) => `| ${cells.join(" | ")} |`);

    const traced: Record<string, { dependsOn?: string[]; context?: string }> = {};
    for (const row of rows) {
      if (!row.requirement) continue;
      const entry = traced[row.requirement] || (traced[row.requirement] = {});
      if (row.dependsOn && row.dependsOn.length > 0) entry.dependsOn = row.dependsOn;
      if (row.context) entry.context = row.context;
    }

    return `${header.concat(body, renderMatrixTraceLines(traced)).join("\n")}\n`;
  }

  const header = [
    "# Traceability Matrix",
    "",
    "Map business specifications to scenarios and technical artifacts.",
    "",
    "| Feature | Scenario | Technical artifact | Status |",
    "|---|---|---|---|",
  ];

  const body = rows.map(
    (row) => `| ${row.feature} | ${row.scenario} | ${row.technicalArtifact} | ${row.status} |`
  );
  return `${header.concat(body).join("\n")}\n`;
}
// ── The matrix as `validate` reads it ────────────────────────────────────────
//
// `parseTraceabilityRows` above maps the matrix to named rows for the commands
// that rewrite it. Validation needs the raw cells instead — a malformed row is
// exactly what it is looking for, so it cannot start by assuming the row parsed.

export type TraceabilityMode = "rich" | "legacy";

export const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
export const LEGACY_HEADER = "| Feature | Scenario | Technical artifact | Status |";

/** Every status a requirement row is allowed to carry. */
export const ALLOWED_STATUS = new Set([
  "Draft",
  "Needs Clarification",
  "Domain Reviewed",
  "Architecture Reviewed",
  "Ready for Dev",
  "Approved",
  "In Dev",
  "In Review",
  "Implemented",
  "Verified",
  "Released",
  "Deprecated",
]);

/** The statuses that mean work has started — everything but `Draft`. */
export const POST_DRAFT_STATUS = new Set([...ALLOWED_STATUS].filter((s) => s !== "Draft"));

/**
 * The statuses that claim the work exists. Before these, a row's declared
 * paths are a plan — the file a requirement is going to land in — and a
 * missing one is not drift. `Deprecated` is excluded: its files may have been
 * removed on purpose.
 */
export const DELIVERED_STATUS = new Set(["Implemented", "Verified", "Released"]);

/** Which of the two matrix shapes this file uses, or `null` if neither header is present. */
export function detectTraceabilityMode(content: string): TraceabilityMode | null {
  if (content.includes(RICH_HEADER)) return "rich";
  if (content.includes(LEGACY_HEADER)) return "legacy";
  return null;
}

/**
 * The data rows, as raw cells.
 *
 * Splitting on `|` leaves an empty cell at each end, so `cells[1]` is the first
 * column; `readRowFields` is where that offset is interpreted, once.
 */
export function parseMatrixRows(content: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.includes("| Requirement | Scenario ID |")) continue;
    if (line.includes("| Feature | Scenario |")) continue;
    rows.push(line.split("|").map((cell) => (cell || "").trim()));
  }
  return rows;
}

export interface MatrixRowFields {
  requirementId: string;
  scenarioId: string;
  testArtifact: string;
  status: string;
}

/** The four columns validation cares about, in whichever shape the matrix has. */
export function readRowFields(cells: string[], mode: TraceabilityMode): MatrixRowFields {
  if (mode === "rich") {
    return {
      requirementId: cells[1] || "",
      scenarioId: cells[2] || "",
      testArtifact: cells[9] || "",
      status: cells[10] || "",
    };
  }
  return {
    requirementId: "",
    scenarioId: cells[2] || "",
    testArtifact: cells[3] || "",
    status: cells[4] || "",
  };
}

/**
 * Rows `--strict-tdd` did not check because they are still `Draft`.
 *
 * The TDD rules exempt a draft on purpose — a requirement nobody has started
 * owes nothing yet — and that is defensible. What was not defensible was the
 * output: `- Strict TDD gate: passed` over three rows with no scenario, no test
 * and a `TBD` artifact reads as "these were checked and they are fine".
 *
 * A cold evaluator called that out as the documentation and the tool
 * disagreeing. The rule is right; the sentence was hiding its own scope. So the
 * count travels with the pass, the way the lock gate already reports how many
 * packs it checked.
 */
export function countDraftExempt(rows: readonly any[]): number {
  let exempt = 0;
  for (const row of rows || []) {
    const status = String(row.status || "").trim();
    if (status !== "Draft") continue;

    const testArtifact = String(row.testArtifact || "").trim();
    const scenarioId = String(row.scenarioId || "").trim();
    const missingTest =
      testArtifact === "" || testArtifact === "-" || testArtifact.toUpperCase() === "TBD";
    const missingScenario = scenarioId === "" || scenarioId === "-";

    if (missingTest || missingScenario) exempt += 1;
  }
  return exempt;
}
