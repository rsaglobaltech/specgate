import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseTraceability, classify, detectOrphans, fileExists } from "../spec/PlanCommand";
import { BaseCommand } from "../../../lib/command";
import { readCapabilityRequirements } from "../../../lib/capability-specs";
import {
  declaredPaths,
  artifactFile,
} from "../../../../packages/core/src/domain/DeclaredArtifacts";
import {
  declaredSpecValues,
  declaredCodeValues,
  compareDeclaredValues,
} from "../../../../packages/core/src";
import type { ValueDriftStatus } from "../../../../packages/core/src/domain/ValueAnnotations";
import type { PlanItem } from "../../../../packages/core/src/domain/RequirementPlan";
import { runMonorepoFanout } from "../../../lib/monorepo-fanout";
import { errorMessage } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";

const HISTORY_REL = "reports/spec-coverage-history.jsonl";
const DONE_CATEGORY = "DONE";

/** One declared value compared across spec and code (§8.6). */
export interface DeclaredValueItem {
  id: string;
  /** The capability requirement's id; null when its heading carries none. */
  requirement: string | null;
  specValue: string | null;
  specFile: string;
  specLine: number;
  codeValue: string | null;
  codeFile: string | null;
  codeLine: number | null;
  status: ValueDriftStatus;
}

/** The declared-value drift model: totals and one row per value. */
export interface DeclaredValuesReport {
  /** Values both sides declare: matched plus diverging. */
  total: number;
  matched: number;
  diverging: number;
  specOnly: number;
  codeOnly: number;
  items: DeclaredValueItem[];
}

/** What `.specops.lock` says about the packs this project came from. */
export interface SpecopsSummary {
  used: boolean;
  packs: Array<{ pack: string; version: string }>;
  baselinePresent: boolean;
  drift: string[];
}

/** A pack entry as `readSpecops` reads it: whichever spelling the lockfile uses. */
interface LockedPackLike {
  pack?: string;
  name?: string;
  version?: string;
  ref?: string;
}

/** The coverage report `buildReport` assembles and both renderers read. */
export interface CoverageReport {
  schemaVersion: number;
  projectDir: string;
  total: number;
  implemented: number;
  pending: number;
  implementedPct: number;
  byCategory: Record<string, number>;
  needsTest: string[];
  orphanFeatures: string[];
  specops: SpecopsSummary;
  requirements: PlanItem[];
  declaredValues: DeclaredValuesReport;
  /** Diagnostics, when a caller attaches them; `renderJson` defaults it to `[]`. */
  status?: unknown[];
}

/**
 * One line of the coverage history. Lines written before §8.6 carry no
 * `values*` fields; `readHistory` keeps any line with an `implementedPct`.
 */
export interface HistoryEntry {
  ts?: string;
  total?: number;
  implemented?: number;
  implementedPct: number;
  valuesTotal?: number;
  valuesMatched?: number;
  valuesDiverging?: number;
}

export function buildReport(projectDir: string): CoverageReport {
  const tracePath = path.join(projectDir, "docs/specs/traceability.md");
  const content = fs.readFileSync(tracePath, "utf8");
  const rows = parseTraceability(content);
  const items: PlanItem[] = rows
    .map((r) => classify(r, (rel: string) => fileExists(projectDir, rel)))
    .filter((x) => x !== null);
  const orphans = detectOrphans(projectDir, items);

  const byCategory = items.reduce((acc: Record<string, number>, it) => {
    acc[it.category] = (acc[it.category] || 0) + 1;
    return acc;
  }, {});

  const total = items.length;
  const implemented = byCategory[DONE_CATEGORY] || 0;
  const implementedPct = total === 0 ? 0 : Math.round((implemented / total) * 1000) / 10;
  const needsTest = items.filter((it) => !it.test_exists).map((it) => it.requirement);

  return {
    schemaVersion: 1,
    projectDir: path.resolve(projectDir),
    total,
    implemented,
    pending: total - implemented,
    implementedPct: implementedPct,
    byCategory: byCategory,
    needsTest: needsTest,
    orphanFeatures: orphans,
    specops: readSpecops(projectDir),
    requirements: items,
    declaredValues: buildDeclaredValues(projectDir, items),
  };
}

/**
 * The declared-value drift model (§8.6): for every capability-spec
 * requirement that declares a `value_<id>=` in its `specgate:trace`, read the
 * code file(s) its matrix row already points at (the same Technical/Test
 * artifact `--strict-links` checks exist) and compare.
 *
 * A requirement with no `value_*` key contributes nothing — this only ever
 * reports on what was explicitly annotated, same restraint as
 * `DeclaredArtifacts`.
 */
export function buildDeclaredValues(
  projectDir: string,
  items: readonly (PlanItem | null | undefined)[]
): DeclaredValuesReport {
  // Keyed by requirement id; a capability requirement without one (null) finds no row.
  const byRequirement = new Map<string | null, PlanItem>();
  for (const it of items) if (it && it.requirement) byRequirement.set(it.requirement, it);

  let matched = 0;
  let diverging = 0;
  let specOnly = 0;
  let codeOnly = 0;
  const allItems: DeclaredValueItem[] = [];

  for (const { req, specFile } of readCapabilityRequirements(projectDir)) {
    const specEntries = declaredSpecValues(req.trace);
    if (specEntries.length === 0) continue;

    const row = byRequirement.get(req.id);
    const codeFiles = new Set<string>();
    for (const cell of [row && row.technical_artifact, row && row.test_artifact]) {
      for (const p of declaredPaths(cell)) codeFiles.add(artifactFile(p));
    }

    const codeEntries: Array<{ id: string; value: string; line: number; file: string }> = [];
    for (const rel of codeFiles) {
      const abs = path.join(projectDir, rel);
      if (!fs.existsSync(abs)) continue;
      let text: string;
      try {
        text = fs.readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      for (const e of declaredCodeValues(text)) codeEntries.push({ ...e, file: rel });
    }

    for (const c of compareDeclaredValues(specEntries, codeEntries)) {
      allItems.push({
        id: c.id,
        requirement: req.id,
        specValue: c.specValue,
        specFile,
        specLine: req.line,
        codeValue: c.codeValue,
        codeFile: c.codeFile,
        codeLine: c.codeLine,
        status: c.status,
      });
      if (c.status === "matched") matched++;
      else if (c.status === "diverging") diverging++;
      else if (c.status === "spec_only") specOnly++;
      else if (c.status === "code_only") codeOnly++;
    }
  }

  return {
    total: matched + diverging,
    matched,
    diverging,
    specOnly,
    codeOnly,
    items: allItems,
  };
}

export function readSpecops(projectDir: string): SpecopsSummary {
  const lockPath = path.join(projectDir, ".specops.lock");
  if (!fs.existsSync(lockPath)) {
    return { used: false, packs: [], baselinePresent: true, drift: [] };
  }
  const drift: string[] = [];
  let packs: LockedPackLike[] = [];
  try {
    // Read as written: a `null` document throws here and is reported below.
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { packs?: unknown };
    packs = Array.isArray(lock.packs) ? lock.packs : [];
  } catch (err) {
    drift.push(`.specops.lock is not valid JSON: ${errorMessage(err)}`);
  }
  const baselinePresent =
    packs.length === 0 || fs.existsSync(path.join(projectDir, ".specops", "baseline"));
  if (!baselinePresent) {
    drift.push(".specops/baseline/ is missing — `specops sync` cannot three-way merge.");
  }
  return {
    used: true,
    packs: packs.map((p) => ({
      pack: p.pack || p.name || "(unknown)",
      version: p.version || p.ref || "",
    })),
    baselinePresent: baselinePresent,
    drift,
  };
}

function readHistory(projectDir: string): HistoryEntry[] {
  const file = path.join(projectDir, HISTORY_REL);
  if (!fs.existsSync(file)) return [];
  const out: HistoryEntry[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const e = JSON.parse(t);
      if (typeof e.implementedPct === "number") out.push(e);
    } catch {
      // A truncated or hand-edited history line is skipped, not fatal: the
      // ledger is append-only telemetry, and one bad line must not lose the rest.
    }
  }
  return out;
}

function appendHistory(projectDir: string, report: CoverageReport, now: Date): void {
  const file = path.join(projectDir, HISTORY_REL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const dv = report.declaredValues || { total: 0, matched: 0, diverging: 0 };
  const entry = {
    ts: now.toISOString(),
    total: report.total,
    implemented: report.implemented,
    implementedPct: report.implementedPct,
    // Additive (§8.6) — an older history line simply lacks these; readHistory
    // only requires `implementedPct` to accept a line, so nothing breaks.
    valuesTotal: dv.total,
    valuesMatched: dv.matched,
    valuesDiverging: dv.diverging,
  };
  fs.appendFileSync(file, JSON.stringify(entry) + "\n");
}

function esc(v: unknown): string {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_LABELS: Record<string, string> = {
  DONE: "Done",
  NEEDS_STATUS_UPDATE: "Awaiting status",
  NEEDS_IMPLEMENTATION: "Code missing",
  NEEDS_TEST: "Test missing",
  NEEDS_FEATURE: "Feature missing",
  NEEDS_EVERYTHING: "Nothing yet",
};

/** One series as SVG polyline coordinates, `w`×`h`, 0–100 scale. */
function sparklineCoords(pts: number[], w: number, h: number, max: number) {
  const step = w / (pts.length - 1);
  return pts.map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`).join(" ");
}

export function sparkline(history: readonly HistoryEntry[]): string {
  const pts = history.map((h) => h.implementedPct);
  if (pts.length < 2) return "";
  const w = 240;
  const h = 40;
  const max = 100;
  const coords = sparklineCoords(pts, w, h, max);
  const last = coords.split(" ").pop()!.split(",");

  // The declared-value trend (§8.6) is a second, dashed series — drawn only
  // when *every* history point has it, never interpolated across a gap left
  // by runs recorded before this feature existed or before anything was
  // annotated. A trend line implying data between two points is worse than
  // no trend line.
  let valueSeries = "";
  const valuePts = history.map((h) =>
    typeof h.valuesTotal === "number" && h.valuesTotal > 0
      ? // `appendHistory` writes valuesMatched alongside valuesTotal.
        Math.round((h.valuesMatched! / h.valuesTotal) * 1000) / 10
      : null
  );
  if (valuePts.every((p) => p !== null)) {
    const vCoords = sparklineCoords(valuePts as number[], w, h, max);
    const vLast = vCoords.split(" ").pop()!.split(",");
    valueSeries =
      `<polyline fill="none" stroke="#1c7ed6" stroke-width="2" stroke-dasharray="4 2" ` +
      `points="${vCoords}"/>` +
      `<circle cx="${vLast[0]}" cy="${vLast[1]}" r="3" fill="#1c7ed6"/>`;
  }

  return (
    `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" ` +
    `aria-label="Coverage trend over ${pts.length} runs">` +
    `<polyline fill="none" stroke="#2f9e44" stroke-width="2" points="${coords}"/>` +
    `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="#2f9e44"/>` +
    valueSeries +
    `</svg>`
  );
}

function tile(value: unknown, label: string, tone = ""): string {
  return (
    `<div class="tile ${tone || ""}">` +
    `<div class="tile-value">${esc(value)}</div>` +
    `<div class="tile-label">${esc(label)}</div></div>`
  );
}

export function renderHtml(
  report: CoverageReport,
  opts?: { generatedAt?: Date; history?: HistoryEntry[] }
): string {
  const generatedAt = (opts && opts.generatedAt) || new Date();
  const history = (opts && opts.history) || [];
  const pct = report.implementedPct;
  const projectName = path.basename(report.projectDir);

  const rows = report.requirements
    .map((it) => {
      const mark = (b: boolean) => (b ? '<span class="ok">✓</span>' : '<span class="no">·</span>');
      const catLabel = CATEGORY_LABELS[it.category] || it.category;
      const catClass = it.category === "DONE" ? "done" : "todo";
      return (
        `<tr>` +
        `<td class="req">${esc(it.requirement)}</td>` +
        `<td>${esc(it.status || "—")}</td>` +
        `<td class="ctr">${mark(it.feature_exists)}</td>` +
        `<td class="ctr">${mark(it.test_exists)}</td>` +
        `<td class="ctr">${mark(it.technical_exists)}</td>` +
        `<td><span class="badge ${catClass}">${esc(catLabel)}</span></td>` +
        `</tr>`
      );
    })
    .join("\n");

  const specopsBlock = report.specops.used
    ? `<h2>Domain packs</h2><p>${
        report.specops.packs
          .map((p) => `<code>${esc(p.pack)}</code> ${esc(p.version)}`)
          .join(", ") || "—"
      }</p>` +
      (report.specops.drift.length
        ? `<ul class="drift">${report.specops.drift.map((d: string) => `<li>${esc(d)}</li>`).join("")}</ul>`
        : `<p class="ok-line">✓ No specops drift detected.</p>`)
    : "";

  const orphanBlock = report.orphanFeatures.length
    ? `<h2>Orphan feature files</h2><ul class="drift">${report.orphanFeatures
        .map((f: string) => `<li><code>${esc(f)}</code></li>`)
        .join("")}</ul>`
    : "";

  // §8.6 — declared-value drift. Only rendered when there is something
  // annotated at all: a project with no `value_*`/`specgate:value` pair has
  // nothing to show, the same restraint `orphanBlock` already applies.
  // The fallback carries no matched/diverging; they are only read when dvSeen > 0.
  const dv: Partial<DeclaredValuesReport> &
    Pick<DeclaredValuesReport, "total" | "specOnly" | "codeOnly" | "items"> =
    report.declaredValues || { total: 0, specOnly: 0, codeOnly: 0, items: [] };
  const dvSeen = dv.total + dv.specOnly + dv.codeOnly;
  const STATUS_LABELS: Record<string, string> = {
    matched: "Matched",
    diverging: "Diverges",
    spec_only: "Spec only",
    code_only: "Code only",
  };
  const declaredValuesBlock = dvSeen
    ? `<h2>Declared values (§8.6)</h2>` +
      `<p class="meta">${dv.matched} matched · ${dv.diverging} diverging · ` +
      `${dv.specOnly} spec-only · ${dv.codeOnly} code-only</p>` +
      `<div class="table-wrap"><table><thead><tr>` +
      `<th>Requirement</th><th>Id</th><th>Spec value</th><th>Code value</th><th>State</th>` +
      `</tr></thead><tbody>` +
      dv.items
        .map((it) => {
          const cls = it.status === "matched" ? "done" : "todo";
          const codeCell = it.codeFile
            ? `<code>${esc(it.codeValue)}</code> <span class="meta">${esc(it.codeFile)}:${esc(it.codeLine)}</span>`
            : '<span class="no">·</span>';
          const specCell =
            it.specValue !== null
              ? `<code>${esc(it.specValue)}</code>`
              : '<span class="no">·</span>';
          return (
            `<tr><td class="req">${esc(it.requirement)}</td><td><code>${esc(it.id)}</code></td>` +
            `<td>${specCell}</td><td>${codeCell}</td>` +
            `<td><span class="badge ${cls}">${esc(STATUS_LABELS[it.status] || it.status)}</span></td></tr>`
          );
        })
        .join("\n") +
      `</tbody></table></div>`
    : "";

  const hasValueTrend = history.some((h) => typeof h.valuesTotal === "number" && h.valuesTotal > 0);
  const trendBlock = sparkline(history)
    ? `<div class="trend"><span class="trend-label">${
        hasValueTrend ? "Coverage (green) · Value match (blue, dashed)" : "Coverage trend"
      }</span>${sparkline(history)}</div>`
    : "";

  const pctTone = pct >= 80 ? "good" : pct >= 40 ? "warn" : "bad";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spec coverage — ${esc(projectName)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 2rem; background: #f7f8fa; color: #1a1a1a; }
  @media (prefers-color-scheme: dark) { body { background: #16181d; color: #e6e6e6; } }
  header { max-width: 960px; margin: 0 auto 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .meta { color: #888; font-size: .85rem; }
  main { max-width: 960px; margin: 0 auto; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem; margin: 1.5rem 0; }
  .tile { background: #fff; border: 1px solid #e3e5e9; border-radius: 10px; padding: 1rem 1.25rem; }
  @media (prefers-color-scheme: dark) { .tile { background: #21242b; border-color: #2f333c; } }
  .tile-value { font-size: 2rem; font-weight: 700; line-height: 1; }
  .tile-label { color: #888; font-size: .8rem; margin-top: .35rem; text-transform: uppercase; letter-spacing: .03em; }
  .tile.good .tile-value { color: #2f9e44; }
  .tile.warn .tile-value { color: #e8a91d; }
  .tile.bad .tile-value { color: #e03131; }
  .bar { height: 12px; border-radius: 6px; background: #e3e5e9; overflow: hidden; margin: .5rem 0 0; }
  @media (prefers-color-scheme: dark) { .bar { background: #2f333c; } }
  .bar > span { display: block; height: 100%; background: #2f9e44; }
  .trend { display: flex; align-items: center; gap: 1rem; margin: 1rem 0; }
  .trend-label { color: #888; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; }
  table { width: 100%; border-collapse: collapse; margin-top: .5rem; font-size: .9rem;
    background: #fff; border: 1px solid #e3e5e9; border-radius: 10px; overflow: hidden; }
  @media (prefers-color-scheme: dark) { table { background: #21242b; border-color: #2f333c; } }
  th, td { padding: .55rem .75rem; text-align: left; border-bottom: 1px solid #eceef1; }
  @media (prefers-color-scheme: dark) { th, td { border-color: #2a2e36; } }
  th { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #888; }
  td.ctr, th.ctr { text-align: center; }
  td.req { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
  .ok { color: #2f9e44; font-weight: 700; }
  .no { color: #c0c4cc; }
  .badge { display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .75rem; }
  .badge.done { background: #d3f9d8; color: #2b8a3e; }
  .badge.todo { background: #fff3bf; color: #b08900; }
  @media (prefers-color-scheme: dark) {
    .badge.done { background: #133a1c; color: #69db7c; }
    .badge.todo { background: #3a3312; color: #ffd43b; }
  }
  h2 { font-size: 1rem; margin: 1.75rem 0 .5rem; }
  .drift { color: #e03131; }
  .ok-line { color: #2f9e44; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em; }
  .table-wrap { overflow-x: auto; }
</style>
</head>
<body>
<header>
  <h1>Spec coverage — ${esc(projectName)}</h1>
  <div class="meta">Generated ${esc(generatedAt.toISOString())} · ${esc(report.total)} requirement(s)</div>
</header>
<main>
  <div class="tiles">
    ${tile(pct + "%", "Implemented", pctTone)}
    ${tile(report.implemented, "Done")}
    ${tile(report.pending, "Pending")}
    ${tile(report.needsTest.length, "Missing a test", report.needsTest.length ? "warn" : "good")}
    ${tile(report.orphanFeatures.length, "Orphan features", report.orphanFeatures.length ? "bad" : "good")}
    ${dvSeen ? tile(dv.diverging, "Value drift", dv.diverging ? "bad" : "good") : ""}
  </div>
  <div class="bar"><span style="width:${pct}%"></span></div>
  ${trendBlock}
  <div class="table-wrap">
  <table>
    <thead><tr>
      <th>REQ</th><th>Status</th><th class="ctr">Feature</th>
      <th class="ctr">Test</th><th class="ctr">Code</th><th>State</th>
    </tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  </div>
  ${specopsBlock}
  ${orphanBlock}
  ${declaredValuesBlock}
</main>
</body>
</html>
`;
}

export interface ReportOptions {
  projectDir: string;
  format: string;
  out: string | null;
  stdout: boolean;
  record: boolean;
}

function toCamelRequirement(item: PlanItem) {
  const {
    scenario_id,
    feature_file,
    technical_artifact,
    test_artifact,
    feature_exists,
    technical_exists,
    test_exists,
    ...rest
  } = item;
  return {
    ...rest,
    scenarioId: scenario_id,
    featureFile: feature_file,
    technicalArtifact: technical_artifact,
    testArtifact: test_artifact,
    featureExists: feature_exists,
    technicalExists: technical_exists,
    testExists: test_exists,
  };
}

export function renderJson(report: CoverageReport): string {
  const wire = {
    ...report,
    requirements: (report.requirements || []).map(toCamelRequirement),
    status: report.status || [],
  };
  return JSON.stringify(wire, null, 2) + "\n";
}

export function parseArgs(argv: string[]) {
  const opts: ReportOptions = {
    projectDir: ".",
    format: "html",
    out: null,
    stdout: false,
    record: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--format" && argv[i + 1]) opts.format = argv[++i];
    else if (a === "--json") {
      opts.format = "json";
      opts.stdout = true;
    } else if (a === "--html") opts.format = "html";
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "--record") opts.record = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        `\n  📊 report — spec-coverage dashboard\n\n` +
          `  USAGE\n` +
          `    specgate report [--project-dir <path>] [--format html|json]\n` +
          `                                  [--out <file>] [--stdout] [--record]\n\n`
      );
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  if (!["html", "json"].includes(opts.format)) {
    process.stderr.write(`Invalid --format: ${opts.format}. Expected: html | json.\n`);
    process.exit(2);
  }
  return opts;
}

export class ReportCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      process.stderr.write(`${errorMessage(err)}\n`);
      process.exit(2);
    }

    const monorepo = runMonorepoFanout(projectDir, "report.js");
    if (monorepo !== null) {
      process.exit(monorepo.failures === 0 ? 0 : 1);
    }

    const tracePath = path.join(projectDir, "docs/specs/traceability.md");
    if (!fs.existsSync(tracePath)) {
      process.stderr.write(`docs/specs/traceability.md not found in ${projectDir}\n`);
      process.exit(2);
    }

    const report = buildReport(projectDir);
    const now = new Date();
    if (opts.record) appendHistory(projectDir, report, now);

    const history = readHistory(projectDir);
    const output =
      opts.format === "json"
        ? renderJson(report)
        : renderHtml(report, { generatedAt: now, history });

    if (opts.stdout) {
      process.stdout.write(output);
    } else {
      const defaultOut =
        opts.format === "json" ? "reports/spec-coverage.json" : "reports/spec-coverage.html";
      const outPath = path.isAbsolute(opts.out || defaultOut)
        ? opts.out || defaultOut
        : path.join(projectDir, opts.out || defaultOut);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, output);
      process.stdout.write(
        ui.header("report") +
          ui.ok(`Wrote ${ui.bold(path.relative(projectDir, outPath) || outPath)}`) +
          `\n  ${ui.progress(report.implemented, report.total, "implemented")}` +
          ui.muted(`   ${report.implementedPct}%`) +
          "\n\n"
      );
    }
    process.exit(0);
  }
}
