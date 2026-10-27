import * as fs from "node:fs";
import * as path from "node:path";
import { EVENTS_DIR } from "./harness-events";

/**
 * What the live view shows of one requirement when it is clicked (REQ-180):
 * its text and scenarios where the specification holds them, its feature,
 * the tests that name it, the assumptions that apply to it, and each attempt
 * the harness made, with the files it changed. Read from the project on
 * request; nothing here is cached.
 */

export interface RequirementDetail {
  id: string;
  title: string;
  status: string;
  group: string;
  statement: string;
  source: { file: string; line: number } | null;
  scenarios: Array<{ id: string; title: string; steps: string[] }>;
  features: string[];
  tests: string[];
  assumptions: Array<{ id: string; text: string; status: string }>;
  attempts: Array<{
    attempt: number;
    result: "pass" | "fail" | "running";
    started: number;
    duration: number;
    failedAt: string | null;
    gates: Array<{ stage: string; result: string }>;
  }>;
  files: Array<{ path: string; added: number; removed: number }>;
}

const ID = /^REQ-\d+$/;
const SKIP = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "test-results",
  ".harness",
  ".specgate",
  "target",
]);
const TEST_FILE =
  /(\.|-|_)(test|spec)\.[cm]?[jt]sx?$|Test\.(java|kt)$|_test\.(go|py)$|test_.*\.py$/;
const MAX_FILES = 4000;

function relative(projectDir: string, file: string): string {
  return path.relative(projectDir, file).split(path.sep).join("/");
}

function walk(dir: string, visit: (file: string) => void, budget = { left: MAX_FILES }): void {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (budget.left <= 0) return;
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) walk(path.join(dir, e.name), visit, budget);
    } else {
      budget.left -= 1;
      visit(path.join(dir, e.name));
    }
  }
}

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** The requirement's block in spec.md, a capability spec or an open change's delta. */
function findBlock(projectDir: string, id: string) {
  const files = [path.join(projectDir, "spec.md")];
  walk(path.join(projectDir, "docs", "specs"), (f) => {
    const rel = relative(projectDir, f);
    if (
      f.endsWith(".md") &&
      !rel.includes("/changes/archive/") &&
      path.basename(f) !== "DRAFTING.md"
    )
      files.push(f);
  });
  const head = new RegExp(`^(##|###\\s+Requirement:)\\s+${id}\\s+[—–-]\\s+(.+?)\\s*$`);
  for (const file of files) {
    const lines = read(file).replace(/\r\n/g, "\n").split("\n");
    const at = lines.findIndex((l) => head.test(l));
    if (at < 0) continue;
    const level = lines[at].startsWith("###") ? 3 : 2;
    let end = lines.length;
    for (let i = at + 1; i < lines.length; i++) {
      const h = /^(#{1,3})\s/.exec(lines[i]);
      if (h && h[1].length <= level) {
        end = i;
        break;
      }
    }
    return { file, line: at + 1, title: head.exec(lines[at])![2], body: lines.slice(at + 1, end) };
  }
  return null;
}

function groupOf(rel: string): string {
  const parts = rel.split("/");
  const at = parts.findIndex((p) => p === "changes" || p === "capabilities");
  return at >= 0 && parts[at + 1] ? parts[at + 1].replace(/^draft-/, "") : "";
}

function attemptsOf(projectDir: string, id: string) {
  const text = read(path.join(projectDir, EVENTS_DIR, `${id}.jsonl`));
  const events: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* a line being written */
    }
  }
  // Each "attempt start" opens a new attempt, in the order they happened: a
  // later run numbers its attempts from 1 again in the same file.
  const runs: Array<[number, Array<Record<string, unknown>>]> = [];
  for (const e of events) {
    const n = Number(e.attempt) || 1;
    const isStart = e.type === "attempt" && e.state === "start";
    if (isStart || runs.length === 0 || runs[runs.length - 1][0] !== n) runs.push([n, []]);
    runs[runs.length - 1][1].push(e);
  }
  const attempts = runs.map(([attempt, list]) => {
    const start = list.find((e) => e.type === "attempt" && e.state === "start") || list[0];
    const end = list.find((e) => e.type === "attempt" && e.state === "end");
    const gates = list
      .filter((e) => e.type === "gate")
      .map((e) => ({ stage: String(e.stage || ""), result: String(e.result || "") }));
    const failed = gates.find((g) => g.result !== "pass");
    const started = Number(start.t) || 0;
    const last = Number((end || list[list.length - 1]).t) || started;
    return {
      attempt,
      result: (end ? (end.result === "pass" ? "pass" : "fail") : "running") as
        "pass" | "fail" | "running",
      started,
      duration: Math.max(0, last - started),
      failedAt: failed ? failed.stage : null,
      gates,
      list,
    };
  });
  const latest = attempts[attempts.length - 1];
  const files = new Map<string, { added: number; removed: number }>();
  for (const e of latest ? latest.list : []) {
    if (e.type !== "step" || (e.kind !== "edit" && e.kind !== "write") || !e.target) continue;
    const f = files.get(String(e.target)) || { added: 0, removed: 0 };
    f.added += Number(e.added) || 0;
    f.removed += Number(e.removed) || 0;
    files.set(String(e.target), f);
  }
  return {
    attempts: attempts.map(({ list: _list, ...a }) => a),
    files: [...files.entries()].map(([p, f]) => ({ path: p, ...f })),
  };
}

export function requirementDetail(projectDir: string, id: string): RequirementDetail | null {
  if (!ID.test(id)) return null;
  const block = findBlock(projectDir, id);
  const rel = block ? relative(projectDir, block.file) : "";
  const body = block ? block.body : [];
  const trace = body.find((l) => l.includes("specgate:trace")) || "";
  const status = (/status="?([A-Za-z ]+?)"?(\s|-->)/.exec(trace) || [])[1] || "Draft";
  const firstScenario = body.findIndex((l) => /^#{3,4}\s+Scenario:/.test(l));
  const statement = (firstScenario >= 0 ? body.slice(0, firstScenario) : body)
    .filter((l) => l.trim() && !l.includes("<!--") && !l.startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const scenarios: RequirementDetail["scenarios"] = [];
  for (const l of body) {
    const s = /^#{3,4}\s+Scenario:\s+(SCN-[\w.]+)\s+[—–-]\s+(.+)$/.exec(l);
    if (s) scenarios.push({ id: s[1], title: s[2].trim(), steps: [] });
    else if (scenarios.length && /^\s*-\s+(GIVEN|WHEN|THEN|AND|BUT)\b/i.test(l)) {
      scenarios[scenarios.length - 1].steps.push(l.replace(/^\s*-\s+/, "").trim());
    }
  }

  const named = new RegExp(`\\b${id}\\b`);
  const features: string[] = [];
  walk(path.join(projectDir, "features"), (f) => {
    if (f.endsWith(".feature") && named.test(read(f))) features.push(relative(projectDir, f));
  });
  const tests: string[] = [];
  walk(projectDir, (f) => {
    const r = relative(projectDir, f);
    if (r.startsWith("docs/") || r.startsWith("features/")) return;
    if (TEST_FILE.test(path.basename(f)) && named.test(read(f))) tests.push(r);
  });

  const assumptions: RequirementDetail["assumptions"] = [];
  if (block) {
    // An open change keeps its assumptions beside its delta; a delivered
    // requirement's are in the archived change that drafted it.
    const changeDir = (/^(.*\/changes\/[^/]+)\//.exec(rel) || [])[1];
    const sources = changeDir ? [path.join(projectDir, changeDir, "assumptions.md")] : [];
    if (!changeDir) {
      walk(path.join(projectDir, "docs", "specs", "changes", "archive"), (f) => {
        if (path.basename(f) === "assumptions.md") sources.push(f);
      });
    }
    for (const source of sources) {
      for (const row of read(source).split("\n")) {
        const cells = row.split("|").map((c) => c.trim());
        if (cells.length < 5 || !/^A\d+$/.test(cells[1]) || !named.test(cells[3] || "")) continue;
        assumptions.push({ id: cells[1], text: cells[2], status: cells[cells.length - 2] || "" });
      }
    }
  }

  const { attempts, files } = attemptsOf(projectDir, id);
  return {
    id,
    title: block ? block.title : "",
    status,
    group: groupOf(rel),
    statement,
    source: block ? { file: rel, line: block.line } : null,
    scenarios,
    features,
    tests,
    assumptions,
    attempts,
    files,
  };
}

export interface MatrixRow {
  requirement: string;
  title: string;
  scenario: string;
  group: string;
  feature: string;
  tests: string[];
  status: string;
  /** "spec" for a delivered requirement, "change" for one still in an open change. */
  source: "spec" | "change";
}

/**
 * The traceability matrix as it stands right now (REQ-181): delivered
 * requirements as `specgate matrix` derives them, and those of open changes
 * from their deltas, each scenario with its feature and the tests that name
 * it. One walk of the project's test files serves every row.
 */
export function liveMatrix(projectDir: string): MatrixRow[] {
  const testsNaming = new Map<string, Set<string>>();
  walk(projectDir, (f) => {
    const r = relative(projectDir, f);
    if (r.startsWith("docs/") || r.startsWith("features/") || !TEST_FILE.test(path.basename(f)))
      return;
    for (const m of read(f).matchAll(/\b(REQ-\d+|SCN-[\w.]+)\b/g)) {
      if (!testsNaming.has(m[1])) testsNaming.set(m[1], new Set());
      testsNaming.get(m[1])!.add(r);
    }
  });
  const featureOf = new Map<string, string>();
  walk(path.join(projectDir, "features"), (f) => {
    if (!f.endsWith(".feature")) return;
    for (const m of read(f).matchAll(/@(REQ-\d+)\b/g)) {
      if (!featureOf.has(m[1])) featureOf.set(m[1], relative(projectDir, f));
    }
  });
  const testsFor = (req: string, scn: string) =>
    [...new Set([...(testsNaming.get(scn) || []), ...(testsNaming.get(req) || [])])].sort();

  const rows: MatrixRow[] = [];
  const seen = new Set<string>();
  const add = (row: MatrixRow) => {
    const key = row.requirement + "|" + row.scenario;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // Every requirement block the specification holds: spec.md, capability
  // specs, and open changes' deltas (never DRAFTING.md or the archive).
  const files = [path.join(projectDir, "spec.md")];
  walk(path.join(projectDir, "docs", "specs"), (f) => {
    const rel = relative(projectDir, f);
    if (
      f.endsWith(".md") &&
      !rel.includes("/changes/archive/") &&
      path.basename(f) !== "DRAFTING.md"
    )
      files.push(f);
  });
  const head = /^(?:##|###\s+Requirement:)\s+(REQ-\d+)\s+[—–-]\s+(.+?)\s*$/;
  for (const file of files) {
    const rel = relative(projectDir, file);
    const inChange = rel.includes("/changes/");
    const lines = read(file).replace(/\r\n/g, "\n").split("\n");
    let current: { id: string; title: string; status: string; scenarios: string[] } | null = null;
    const flush = () => {
      if (!current) return;
      const scns = current.scenarios.length ? current.scenarios : ["-"];
      for (const scn of scns) {
        add({
          requirement: current.id,
          title: current.title,
          scenario: scn,
          group: groupOf(rel) || (featureOf.get(current.id) || "").split("/")[1] || "",
          feature: featureOf.get(current.id) || "",
          tests: testsFor(current.id, scn),
          status: current.status,
          source: inChange ? "change" : "spec",
        });
      }
    };
    for (const l of lines) {
      const h = head.exec(l);
      if (h) {
        flush();
        current = { id: h[1], title: h[2], status: "Draft", scenarios: [] };
        continue;
      }
      if (!current) continue;
      if (l.includes("specgate:trace")) {
        const st = /status="?([A-Za-z ]+?)"?(\s|-->)/.exec(l);
        if (st) current.status = st[1];
      }
      const s = /^#{3,4}\s+Scenario:\s+(SCN-[\w.]+)/.exec(l);
      if (s) current.scenarios.push(s[1]);
    }
    flush();
  }
  return rows.sort(
    (a, b) => a.requirement.localeCompare(b.requirement) || a.scenario.localeCompare(b.scenario)
  );
}
