/**
 * The domain catalogs a pack writes — `docs/specs/aggregates.md`,
 * `events.md`, `commands.md`, `use-cases.md`, `domain-model.md` — are shared
 * by every pack a project installs. Writing each one whole made the last pack
 * installed win: a project with six packs listed one pack's aggregates.
 * Found building a real product from six packs (golden_app, finding #22).
 *
 * The fix is to treat a catalog as tables of rows keyed by their first
 * column. A pack's rows replace rows with the same id and join the rest;
 * rows other packs wrote stay. Pure: strings in, string out.
 */

const ROW = /^\|.*\|\s*$/;
const SEPARATOR = /^\|(\s*:?-{3,}:?\s*\|)+\s*$/;

interface Table {
  /** Index of the header line. */
  start: number;
  /** Index one past the last row. */
  end: number;
  rows: string[];
}

function tablesIn(lines: string[]): Table[] {
  const tables: Table[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!ROW.test(lines[i]) || !SEPARATOR.test(lines[i + 1])) continue;
    let end = i + 2;
    while (end < lines.length && ROW.test(lines[end])) end += 1;
    tables.push({ start: i, end, rows: lines.slice(i + 2, end) });
    i = end - 1;
  }
  return tables;
}

function idOf(row: string): string {
  return row.split("|")[1]?.trim() ?? "";
}

/** `AGG-2` before `AGG-10`. */
function byId(a: string, b: string): number {
  return idOf(a).localeCompare(idOf(b), undefined, { numeric: true });
}

/**
 * `fresh` (what this pack renders) with every table's rows merged into the
 * matching table of `existing` (what the project has). Tables are matched by
 * position and header; when the two documents do not have the same tables,
 * `fresh` is returned unchanged, because guessing would be worse.
 */
export function mergeCatalog(existing: string | null, fresh: string): string {
  if (existing === null || existing === fresh) return fresh;
  const oldLines = existing.replace(/\r\n/g, "\n").split("\n");
  const newLines = fresh.split("\n");
  const oldTables = tablesIn(oldLines);
  const newTables = tablesIn(newLines);
  if (
    oldTables.length !== newTables.length ||
    oldTables.some((t, i) => oldLines[t.start] !== newLines[newTables[i].start])
  ) {
    return fresh;
  }

  // Splice from the last table backwards so earlier indexes stay valid.
  for (let i = newTables.length - 1; i >= 0; i -= 1) {
    const mine = newTables[i];
    const ids = new Set(mine.rows.map(idOf).filter((id) => id && id !== "-"));
    const kept = oldTables[i].rows.filter((r) => !ids.has(idOf(r)));
    const rows = [...kept, ...mine.rows].sort(byId);
    newLines.splice(mine.start + 2, mine.rows.length, ...rows);
  }
  return newLines.join("\n");
}

/** Where `expand` writes the catalogs every pack in a project shares. */
export const CATALOG_DOCS: ReadonlyArray<string> = [
  "docs/specs/domain-model.md",
  "docs/specs/use-cases.md",
  "docs/specs/commands.md",
  "docs/specs/events.md",
  "docs/specs/aggregates.md",
];
