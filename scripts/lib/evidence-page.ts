/**
 * One page for a change's evidence (ADR-0047, REQ-807):
 * `docs/specs/changes/<change>/EVIDENCE.md`, each requirement before its code
 * and after it — the last screenshot of each test side by side, copied beside
 * the page under a size cap, its diagrams, and where its videos and traces
 * are. Written the same way every time: no clock, everything sorted.
 *
 * The evidence is gathered once into a model; the Markdown page and, on
 * request, the HTML page (REQ-818) are two renderings of it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { EVIDENCE_DIR, readAttempts } from "./evidence";
import { baseOf } from "./quality-run";
import { requirementDiagrams, type RequirementDiagrams } from "./evidence-diagrams";
import { hideSecrets, httpCalls, type HttpCall } from "./trace-zip";
import {
  scenarioOutcomes,
  type ScenarioOutcome,
} from "../../packages/core/src/domain/ScenarioOutcomes";

/** A picture larger than this is named on the page, not copied into the repository. */
export const MAX_PICTURE_BYTES = 300 * 1024;
const PICTURE = /\.(png|jpe?g|webp|gif)$/i;
const MEDIA = /\.(webm|mp4|zip)$/i;

export interface PageRequirement {
  id: string;
  title: string;
  before: boolean;
  after: boolean;
  screenshots: number;
  sequences: number;
  classes: number;
}

/** The requirements a change's deltas add or modify, in the order they are written. */
function requirementsOf(changeDir: string): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  const specs = path.join(changeDir, "specs");
  let caps: string[] = [];
  try {
    caps = fs.readdirSync(specs).sort();
  } catch {
    return out;
  }
  for (const cap of caps) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(specs, cap, "spec.md"), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/^#{2,4}\s+Requirement:\s*(REQ-[\w.]+)\s*[—–-]\s*(.+)$/gm)) {
      if (!out.some((r) => r.id === m[1])) out.push({ id: m[1], title: m[2].trim() });
    }
  }
  return out;
}

function readJson(file: string): { artifacts?: string[] } | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** `artifacts/[<workspace>/]<test>/<file>` → the test's folder, the runner's one per test. */
const testOf = (artifact: string) => artifact.split("/").slice(-2)[0] || "-";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A test's folder as a reader names it: the scenario it ran, when the folder
 * ends with that scenario's title — Playwright cuts the start of the title
 * and adds its file, a hash and the project — or the folder without them.
 */
function testLabel(folder: string, titles: string[]): string {
  const rest = folder.replace(/^.*?-[0-9a-f]{5}-+/, "");
  const found = titles
    .filter((t) => slug(t).length > 0 && slug(rest).includes(slug(t).slice(-24)))
    .sort((a, b) => b.length - a.length)[0];
  return found || rest.replace(/-/g, " ");
}

/** The last picture of each test, by its folder. */
function lastPictures(artifacts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of [...artifacts].sort()) if (PICTURE.test(a)) out.set(testOf(a), a);
  return out;
}

const code = (p: string) => `\`${p}\``;

/** A table cell: no pipe, no line break. */
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

interface Side {
  name: "before" | "after";
  doc: { artifacts?: string[] } | null;
  from: string;
}

/** What a side's runner printed: `before/run.log`, or the delivery's `bdd.log`. */
function logOf(projectDir: string, side: Side): string {
  const file = side.name === "before" ? "run.log" : "bdd.log";
  try {
    return fs.readFileSync(path.join(projectDir, side.from, file), "utf8");
  } catch {
    return "";
  }
}

const filesOf = (side: Side, test: RegExp) => (side.doc?.artifacts || []).filter((a) => test.test(a)).sort();

// ── The model ────────────────────────────────────────────────────────────────

/** One side's last picture of a test. */
export interface Picture {
  /** Where it is, from the project. */
  readonly source: string;
  /** Where the Markdown page copied it, from the change; empty when too big to copy. */
  readonly copied: string;
  readonly tooBig: boolean;
}

export interface CallPair {
  /** `POST /api/orders`. */
  readonly key: string;
  readonly before?: HttpCall;
  readonly after?: HttpCall;
  /** Whether what the service answered changed, a timestamp or an id aside. */
  readonly changed: boolean;
}

export interface RequirementEvidence {
  readonly id: string;
  readonly title: string;
  readonly hasBefore: boolean;
  readonly hasAfter: boolean;
  readonly screens: ReadonlyArray<{ test: string; before: Picture | null; after: Picture | null }>;
  readonly tooBig: ReadonlyArray<string>;
  /** Videos and traces, from the project. */
  readonly media: ReadonlyArray<string>;
  readonly scenarios: ReadonlyArray<{
    scenario: string;
    before?: ScenarioOutcome;
    after?: ScenarioOutcome;
  }>;
  readonly calls: ReadonlyArray<CallPair>;
  readonly ai: ReadonlyArray<{ side: "before" | "after"; decision: Record<string, unknown> }>;
  /** Deliveries whose scenarios failed, oldest first: why, and what the AI decided (REQ-819). */
  readonly attempts: ReadonlyArray<AttemptEvidence>;
  readonly diagrams: RequirementDiagrams;
}

export interface AttemptEvidence {
  readonly n: number;
  readonly failed: ReadonlyArray<ScenarioOutcome>;
  readonly ai: ReadonlyArray<Record<string, unknown>>;
}

/** The AI log lines of one run folder, secrets hidden. */
function decisionsIn(projectDir: string, from: string, artifacts: string[]): Array<Record<string, unknown>> {
  return artifacts
    .filter((a) => /ai-decisions\.jsonl$/.test(a))
    .sort()
    .flatMap((a) => {
      try {
        return fs
          .readFileSync(path.join(projectDir, from, a), "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => hideSecrets(JSON.parse(l)) as Record<string, unknown>);
      } catch {
        return [];
      }
    });
}

/** Each kept attempt of a requirement: its failed scenarios, its AI decisions. */
function attemptsOf(projectDir: string, id: string): AttemptEvidence[] {
  return readAttempts(projectDir, id).map((a) => {
    const from = `${EVIDENCE_DIR}/${id}/attempts/${a.n}`;
    const run = readJson(path.join(projectDir, from, "run.json"));
    let log = "";
    try {
      log = fs.readFileSync(path.join(projectDir, from, "run.log"), "utf8");
    } catch {
      /* no log kept */
    }
    return {
      n: a.n,
      failed: scenarioOutcomes(log).filter((o) => !o.passed),
      ai: decisionsIn(projectDir, from, run?.artifacts || []),
    };
  });
}

/** A timestamp or an id differs on every run: not a change in what the service answers. */
const steady = (s: string) =>
  s
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?/g, "<time>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/("(?:requestId|traceId|id)"\s*:\s*)"[^"]*"/g, '$1"<id>"');

/** A requirement's evidence, gathered: what both pages show. */
function gather(
  projectDir: string,
  id: string,
  title: string,
  base: string
): RequirementEvidence {
  const root = path.join(projectDir, EVIDENCE_DIR, id);
  const before = readJson(path.join(root, "before", "run.json"));
  const after = readJson(path.join(root, "evidence.json"));
  const sides: Side[] = [
    { name: "before", doc: before, from: `${EVIDENCE_DIR}/${id}/before` },
    { name: "after", doc: after, from: `${EVIDENCE_DIR}/${id}` },
  ];
  const diagrams = requirementDiagrams(projectDir, id, base);

  // Screens: a row per test, its last picture on each side.
  const pictures = sides.map((s) => lastPictures(s.doc?.artifacts || []));
  const tests = [...new Set(pictures.flatMap((p) => [...p.keys()]))].sort();
  const titles = diagrams.sequences.map((s) => s.scenario);
  const picture = (i: number, test: string): Picture | null => {
    const a = pictures[i].get(test);
    if (!a) return null;
    const source = `${sides[i].from}/${a}`;
    let size = Infinity;
    try {
      size = fs.statSync(path.join(projectDir, source)).size;
    } catch {
      return null;
    }
    const tooBig = size > MAX_PICTURE_BYTES;
    return {
      source,
      tooBig,
      copied: tooBig ? "" : `evidence/${id}/${sides[i].name}/${a.replace(/^artifacts\//, "")}`,
    };
  };
  const screens = tests.map((t) => ({ test: testLabel(t, titles), before: picture(0, t), after: picture(1, t) }));
  const tooBig: string[] = [];
  for (const s of sides) {
    for (const a of filesOf(s, PICTURE)) {
      try {
        if (fs.statSync(path.join(projectDir, s.from, a)).size > MAX_PICTURE_BYTES)
          tooBig.push(`${s.from}/${a}`);
      } catch {
        /* gone since the run */
      }
    }
  }
  const media = sides.flatMap((s) => filesOf(s, MEDIA).map((a) => `${s.from}/${a}`)).sort();

  // REQ-815: one row per scenario the runner reported.
  const outcomes = sides.map((s) => scenarioOutcomes(logOf(projectDir, s)));
  const scenarios = [...new Set(outcomes.flatMap((o) => o.map((r) => r.scenario)))].map((scenario) => ({
    scenario,
    before: outcomes[0].find((x) => x.scenario === scenario),
    after: outcomes[1].find((x) => x.scenario === scenario),
  }));

  // REQ-816: the calls to the service, from each trace, paired by method and path.
  const traced = sides.map((s) =>
    filesOf(s, /trace\.zip$/).flatMap((a) => httpCalls(path.join(projectDir, s.from, a)))
  );
  const keys = [...new Set(traced.flatMap((c) => c.map((x) => `${x.method} ${x.path}`)))];
  const calls = keys.map((key) => {
    const [b, a] = traced.map((list) => list.find((x) => `${x.method} ${x.path}` === key));
    const changed = !(b && a && b.status === a.status && steady(b.response) === steady(a.response));
    return { key, before: b, after: a, changed };
  });

  // REQ-817: what the AI model decided, when the project records it.
  const ai = sides.flatMap((s) =>
    filesOf(s, /ai-decisions\.jsonl$/).flatMap((a) => {
      try {
        return fs
          .readFileSync(path.join(projectDir, s.from, a), "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => ({ side: s.name, decision: hideSecrets(JSON.parse(l)) as Record<string, unknown> }));
      } catch {
        return [];
      }
    })
  );
  return {
    id,
    title,
    hasBefore: before !== null,
    hasAfter: after !== null,
    screens,
    tooBig: tooBig.sort(),
    media,
    scenarios,
    calls,
    ai,
    attempts: attemptsOf(projectDir, id),
    diagrams,
  };
}

// ── The Markdown page ────────────────────────────────────────────────────────

/** A scenario's outcome as one line: ✓ and its time, or ✘, its time and why. */
export function outcomeText(r: ScenarioOutcome | undefined): string {
  if (!r) return "—";
  if (r.passed) return `✓ ${r.time}`.trim();
  const why = [r.step && `${r.step.slice(0, 90)}${r.step.length > 90 ? "…" : ""}:`, r.reason.join(" · ")]
    .filter(Boolean)
    .join(" ");
  return `✘ ${r.time}${why ? ` — ${why}` : ""}`.trim();
}

/** Why an attempt failed: each failed scenario and its outcome. */
export const attemptWhy = (a: AttemptEvidence) =>
  a.failed.length ? a.failed.map((o) => `${o.scenario}: ${outcomeText(o)}`).join("; ") : "its scenarios failed";

/** What the AI decided in an attempt: each input and its output. */
export const attemptAi = (a: AttemptEvidence) =>
  a.ai.map((d) => `${valueText(d.model)}: ${valueText(d.input)} → ${valueText(d.output)}`).join("; ") || "—";

export const statusText = (x: HttpCall | undefined) => (x ? `${x.status} ${x.statusText}`.trim() : "—");
export const valueText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

function markdownOf(r: RequirementEvidence): string[] {
  const lines = [`## ${r.id} — ${r.title}`, ""];
  if (r.screens.length) {
    const shot = (p: Picture | null, side: string) =>
      !p ? "—" : p.tooBig ? `${code(path.basename(p.source))} (over 300 KB)` : `![${side}](${p.copied})`;
    lines.push("| Test | Before | After |", "| --- | --- | --- |");
    for (const s of r.screens) lines.push(`| ${s.test} | ${shot(s.before, "before")} | ${shot(s.after, "after")} |`);
    lines.push("");
  }

  const notes: string[] = [];
  for (const p of r.tooBig) notes.push(`- ${code(p)} — over 300 KB, not copied`);
  if (r.media.length) notes.push(`- Video and traces: ${r.media.map(code).join(", ")}`);
  if (!r.hasBefore) notes.push(`- No before: \`specgate evidence before ${r.id}\``);
  if (!r.hasAfter) notes.push(`- Not delivered yet: \`specgate apply ${r.id}\``);
  if ((r.hasBefore || r.hasAfter) && r.screens.length === 0)
    notes.push("- No screenshots: `specgate doctor` says how to have the runner keep them");
  if (notes.length) lines.push(...notes, "");

  if (r.scenarios.length) {
    lines.push("#### Scenarios", "", "| Scenario | Before | After |", "| --- | --- | --- |");
    for (const s of r.scenarios)
      lines.push(`| ${cell(s.scenario)} | ${cell(outcomeText(s.before))} | ${cell(outcomeText(s.after))} |`);
    lines.push("");
  }

  if (r.calls.length) {
    lines.push("#### Calls to the service", "", "| Call | Before | After |", "| --- | --- | --- |");
    for (const c of r.calls)
      lines.push(`| ${code(c.key)} | ${cell(statusText(c.before))} | ${cell(statusText(c.after))} |`);
    lines.push("");
    for (const c of r.calls.filter((x) => x.changed)) {
      const block = (label: string, text: string) => (text ? [`${label}:`, "", "```json", text, "```", ""] : []);
      lines.push(
        `<details><summary>${c.key} — bodies</summary>`,
        "",
        ...block("Request", (c.after || c.before)!.request),
        ...block(`Before (${statusText(c.before)})`, c.before?.response || ""),
        ...block(`After (${statusText(c.after)})`, c.after?.response || ""),
        "</details>",
        ""
      );
    }
  }

  if (r.ai.length) {
    lines.push("#### AI decisions", "", "| | Model | Input | Output | Time |", "| --- | --- | --- | --- | --- |");
    for (const { side, decision: d } of r.ai) {
      lines.push(
        `| ${side === "before" ? "Before" : "After"} | ${cell(valueText(d.model))} | ${cell(valueText(d.input)).slice(0, 160)} | ${code(cell(valueText(d.output)).slice(0, 200))} | ${d.ms === undefined ? "" : `${cell(valueText(d.ms))} ms`} |`
      );
    }
    lines.push("");
  }

  if (r.attempts.length) {
    lines.push("#### Failed attempts", "", "| Attempt | Why it failed | AI decisions |", "| --- | --- | --- |");
    for (const a of r.attempts) lines.push(`| ${a.n} | ${cell(attemptWhy(a))} | ${cell(attemptAi(a))} |`);
    lines.push("");
  }

  // Diagrams: each scenario, then the code, now — and the base folded under it.
  const fence = (text: string) => ["```mermaid", text.trimEnd(), "```"];
  const folded = (label: string, text: string) => [
    `<details><summary>${label}</summary>`,
    "",
    ...fence(text),
    "",
    "</details>",
  ];
  for (const s of r.diagrams.sequences) {
    lines.push(`### ${s.scenario}`, "");
    if (s.after) lines.push(...fence(s.after), "");
    if (s.before === null) lines.push("New since the base.", "");
    else if (s.after === null) lines.push(...folded("Removed — at the base", s.before), "");
    else if (s.before === s.after) lines.push("Unchanged since the base.", "");
    else lines.push(...folded("At the base", s.before), "");
  }
  for (const c of r.diagrams.classes) {
    lines.push(`### Classes — ${c.file}`, "", ...fence(c.after), "");
    if (c.legend) lines.push(c.legend, "");
    if (c.before !== null) lines.push(...folded("At the base", c.before), "");
    else lines.push("New since the base.", "");
  }
  return lines;
}

/** The change's evidence, gathered: what `writeEvidencePage` and the HTML page draw. */
export function changeEvidence(projectDir: string, changeId: string, base = ""): RequirementEvidence[] {
  const changeDir = path.join(projectDir, "docs", "specs", "changes", changeId);
  const from = evidenceBase(projectDir, changeId, base);
  return requirementsOf(changeDir).map(({ id, title }) => gather(projectDir, id, title, from));
}

/**
 * The commit the diagrams compare with (REQ-821): the one named, else the
 * gate's base — unless that is HEAD itself with the change already committed,
 * as when the work is done on main: then the commit before the change was
 * opened, so its code shows as new rather than "unchanged since the base".
 */
export function evidenceBase(projectDir: string, changeId: string, explicit = ""): string {
  if (explicit) return explicit;
  const git = (...args: string[]) => {
    const r = spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
    return r.status === 0 ? (r.stdout || "").trim() : "";
  };
  const base = baseOf(projectDir);
  if (!base || base !== git("rev-parse", "HEAD")) return base;
  const opened = git("log", "--reverse", "--format=%H", "--", `docs/specs/changes/${changeId}`).split("\n")[0];
  return (opened && git("rev-parse", "--verify", "--quiet", `${opened}^`)) || base;
}

/**
 * Writes the page. `base` is the ref its diagrams compare with (REQ-814);
 * empty, the base `check --affected` uses.
 */
export function writeEvidencePage(
  projectDir: string,
  changeId: string,
  base = "",
  gathered: RequirementEvidence[] = changeEvidence(projectDir, changeId, base)
): { file: string; requirements: PageRequirement[] } {
  const changeDir = path.join(projectDir, "docs", "specs", "changes", changeId);
  const copies = path.join(changeDir, "evidence");
  fs.rmSync(copies, { recursive: true, force: true });
  const lines = [
    `# Evidence — ${changeId}`,
    "",
    `> Written by \`specgate evidence ${changeId}\` (ADR-0047): each requirement before its code and after it.`,
    "> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.",
    "",
  ];
  const summary: PageRequirement[] = [];
  for (const r of gathered) {
    let copied = 0;
    for (const s of r.screens) {
      for (const p of [s.before, s.after]) {
        if (!p || p.tooBig) continue;
        fs.mkdirSync(path.dirname(path.join(changeDir, p.copied)), { recursive: true });
        fs.copyFileSync(path.join(projectDir, p.source), path.join(changeDir, p.copied));
        copied += 1;
      }
    }
    lines.push(...markdownOf(r));
    summary.push({
      id: r.id,
      title: r.title,
      before: r.hasBefore,
      after: r.hasAfter,
      screenshots: copied,
      sequences: r.diagrams.sequences.length,
      classes: r.diagrams.classes.length,
    });
  }

  const file = path.join(changeDir, "EVIDENCE.md");
  fs.writeFileSync(file, lines.join("\n").trimEnd() + "\n", "utf8");
  return {
    file: path.relative(projectDir, file).split(path.sep).join("/"),
    requirements: summary,
  };
}
