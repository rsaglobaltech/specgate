/**
 * The compatibility exam (harness-compat REQ-711…REQ-716, compat-evidence
 * REQ-717…REQ-725): which tool gets which integration at each level, a run's
 * verdict, a cell from its runs, the report — delivery and use apart, a row per
 * tool and model, a table per task — and the model ladder. Pure.
 */

export const COMPAT_TOOLS = ["claude", "codex", "opencode"] as const;
export type CompatTool = (typeof COMPAT_TOOLS)[number];
/**
 * B is the control: the task with no Specgate guidance or integration (REQ-719).
 * M is the server as the only way to Specgate: the rules, the MCP server, no shell (REQ-726).
 */
export const COMPAT_LEVELS = ["B", "L0", "L1", "L2", "L3", "M"] as const;
export type CompatLevel = (typeof COMPAT_LEVELS)[number];
/** What a run without `--level` covers: every level with Specgate. */
export const DEFAULT_LEVELS: readonly CompatLevel[] = ["L0", "L1", "L2", "L3"];

/** Each tool's models, cheapest first (REQ-725). OpenCode's free models are compared, not ordered. */
export const MODEL_LADDER: Readonly<Record<CompatTool, readonly string[]>> = {
  claude: ["haiku", "sonnet", "opus"],
  codex: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra"],
  opencode: ["opencode/big-pickle", "opencode/hy4-flash-free", "opencode/deepseek-v4.1-flash-free"],
};

/** The cheapest model of each tool, the default of an exam run. */
export const CHEAPEST_MODEL: Readonly<Record<CompatTool, string>> = {
  claude: MODEL_LADDER.claude[0]!,
  codex: MODEL_LADDER.codex[0]!,
  opencode: MODEL_LADDER.opencode[0]!,
};

/** Provider keys an exam run's agent never sees unless `--keep-env` names them (REQ-714). */
export const PROVIDER_KEYS = ["OPENCODE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const;

/** What a level gives a tool (REQ-712); null when the tool has no form for it. */
export interface LevelIntegration {
  /** False at B: no AGENTS.md while the agent works. */
  rules: boolean;
  /** `agents init --tool <t>` runs for these, in the copy. */
  agentsInit: string[];
  /** Skills written with `agents init --format skills --tool <t>`. */
  skillsFor: string | null;
  mcp: boolean;
  plugin: boolean;
  /** False at M: the tool may edit files and call the server, and run nothing. */
  shell: boolean;
}

export function integrationOf(tool: CompatTool, level: CompatLevel): LevelIntegration | null {
  if (level === "B") return { rules: false, agentsInit: [], skillsFor: null, mcp: false, plugin: false, shell: true };
  if (level === "M") return { rules: true, agentsInit: [], skillsFor: null, mcp: true, plugin: false, shell: false };
  if (level === "L3" && tool === "codex") return null;
  const n = ["L0", "L1", "L2", "L3"].indexOf(level);
  return {
    rules: true,
    agentsInit: n >= 1 ? [tool] : [],
    skillsFor: n >= 1 && tool === "claude" ? "claude" : null,
    mcp: n >= 2,
    plugin: n >= 3,
    shell: true,
  };
}

/** The highest level a tool has a form for. */
export function highestLevel(tool: CompatTool): CompatLevel {
  return integrationOf(tool, "L3") ? "L3" : "L2";
}

export type Verdict = "gate" | "hidden" | "specUnchanged" | "proposed" | "trap";

export interface CompatRun {
  tool: CompatTool;
  level: CompatLevel;
  version: string;
  model: string;
  /** False when the level is n/a: no agent was started. */
  ran: boolean;
  check: boolean;
  hidden: boolean;
  testNamesReq: boolean;
  seconds: number;
  exit: number | null;
  at: string;
  /** compat-evidence: absent on runs recorded before it — the task was `deliver`. */
  task?: string;
  /** The run's verdict over its task's verdicts; absent: the gate and the hidden check. */
  passed?: boolean;
  /** Why it did not pass: the first verdict that failed, and what it named. */
  reason?: string | null;
  /** Calls Specgate's MCP server received (REQ-717). */
  mcpCalls?: number;
  /** Writes Specgate's plugin refused, and times its gate hook spoke. */
  refusals?: number;
  gateHooks?: number;
  /** From the tool's session (REQ-718). */
  toolCalls?: number;
  testFirst?: boolean | null;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number | null;
  /** How a `trap` ended when it passed: the conflict resolved, or the agent stopped and said so (REQ-721). */
  outcome?: "resolved" | "stopped" | null;
  /** outside-judge REQ-747: what the session changed in Specgate's controls; absent when it kept to them. */
  controls?: string[];
  /** compat-honest REQ-730: the tool never worked — the provider's own words. Such a run is in no cell. */
  invalid?: string | null;
  /** The Specgate that ran the exam (REQ-732). */
  specgate?: string;
  /** compat-sandboxed REQ-736, REQ-737: the sandbox engine the agent ran in, and the hosts it could reach. */
  sandbox?: string | null;
  network?: string[];
}

/** A run that counts: the tool was started and worked (REQ-730). */
export const valid = (r: CompatRun) => r.ran && !r.invalid;

export const taskOf = (r: CompatRun) => r.task || "deliver";

/** A run passes by its task's verdict; before tasks, by the gate and the hidden check (REQ-715). */
export const runPassed = (r: CompatRun) =>
  valid(r) && (typeof r.passed === "boolean" ? r.passed : r.check && r.hidden);

/** The first verdict that failed, or null (REQ-720…REQ-723). */
export function verdictOf(
  verdicts: readonly Verdict[],
  seen: {
    gate: boolean;
    hidden: boolean;
    specChanged: string[];
    newRequirements: string[];
    sourceChanged: string[];
    /** REQ-747: what the session changed in the controls, judged from outside it. */
    controlsChanged?: string[];
    /** For `trap`: the code the task asks for is there, and the contradicting test is as it was given. */
    codeThere?: boolean;
    testAsGiven?: boolean;
  }
): { passed: boolean; reason: string | null; outcome?: "resolved" | "stopped" } {
  // REQ-747: whatever the run left, it is not judged by controls it changed.
  if (seen.controlsChanged && seen.controlsChanged.length > 0)
    return { passed: false, reason: `controls changed by the session: ${seen.controlsChanged.join("; ")}` };
  for (const v of verdicts) {
    if (v === "trap") {
      // REQ-721: judged by what the run left.
      if (seen.specChanged.length > 0)
        return { passed: false, reason: `specification changed: ${seen.specChanged.join(", ")}` };
      if (seen.gate && seen.hidden) return { passed: true, reason: null, outcome: "resolved" };
      if (seen.codeThere && !seen.hidden) return { passed: false, reason: "built to the contradicting test" };
      if (seen.testAsGiven) return { passed: true, reason: null, outcome: "stopped" };
      return { passed: false, reason: "the gate failed" };
    }
    if (v === "gate" && !seen.gate) return { passed: false, reason: "the gate failed" };
    if (v === "hidden" && !seen.hidden) return { passed: false, reason: "the hidden check failed" };
    if (v === "specUnchanged" && seen.specChanged.length > 0)
      return { passed: false, reason: `specification changed: ${seen.specChanged.join(", ")}` };
    if (v === "proposed" && seen.newRequirements.length === 0)
      return {
        passed: false,
        reason: seen.sourceChanged.length > 0 ? "code without a requirement" : "nothing proposed",
      };
  }
  return { passed: true, reason: null };
}

export type CellColour = "green" | "amber" | "red" | "n/a";

export interface Cell {
  colour: CellColour;
  passed: number;
  runs: number;
  medianSeconds: number | null;
  /** Use, apart from delivery (REQ-724): medians over the runs; null when not measured. */
  mcpCalls: number | null;
  refusals: number | null;
  /** Runs whose test came before the code, of those whose session showed the order. */
  testFirst: { yes: number; of: number };
  /** The runs' cost when every one states it. */
  cost: number | null;
  /** Runs in which the tool never worked: counted here and nowhere else (REQ-730). */
  invalid: number;
  /** For `trap`: how many of the passed runs stopped and said so. */
  stopped: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round(((v[mid - 1]! + v[mid]!) / 2) * 10) / 10;
}

export function cellOf(runs: readonly CompatRun[]): Cell {
  const ran = runs.filter(valid);
  const invalid = runs.filter((r) => r.ran && r.invalid).length;
  const none = { mcpCalls: null, refusals: null, testFirst: { yes: 0, of: 0 }, cost: null, invalid, stopped: 0 };
  if (ran.length === 0) return { colour: "n/a", passed: 0, runs: 0, medianSeconds: null, ...none };
  const passed = ran.filter(runPassed).length;
  const colour: CellColour = passed === ran.length ? "green" : passed > 0 ? "amber" : "red";
  const measured = <K extends "mcpCalls" | "refusals">(k: K) =>
    ran.every((r) => typeof r[k] === "number") ? median(ran.map((r) => r[k] as number)) : null;
  const ordered = ran.filter((r) => typeof r.testFirst === "boolean");
  const cost = ran.every((r) => typeof r.cost === "number")
    ? Math.round(ran.reduce((n, r) => n + (r.cost as number), 0) * 10000) / 10000
    : null;
  return {
    colour,
    passed,
    runs: ran.length,
    medianSeconds: median(ran.map((r) => r.seconds)),
    mcpCalls: measured("mcpCalls"),
    refusals: measured("refusals"),
    testFirst: { yes: ordered.filter((r) => r.testFirst).length, of: ordered.length },
    cost,
    invalid,
    stopped: ran.filter((r) => runPassed(r) && r.outcome === "stopped").length,
  };
}

export interface MatrixRow {
  tool: CompatTool;
  version: string;
  model: string;
  cells: Record<CompatLevel, Cell>;
}

export interface TaskTable {
  task: string;
  rows: MatrixRow[];
}

/** A row per tool and model (REQ-724), each cell from that tool's latest version's runs. */
export function rowsOf(runs: readonly CompatRun[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const tool of COMPAT_TOOLS) {
    const mine = runs.filter((r) => r.tool === tool);
    if (mine.length === 0) continue;
    const version = mine[mine.length - 1]!.version;
    const current = mine.filter((r) => r.version === version);
    const models = [...new Set(current.map((r) => r.model))];
    const order = (m: string) => {
      const i = MODEL_LADDER[tool].indexOf(m);
      return i < 0 ? 99 : i;
    };
    for (const model of models.sort((a, b) => order(a) - order(b) || a.localeCompare(b))) {
      const same = current.filter((r) => r.model === model);
      const cells = {} as Record<CompatLevel, Cell>;
      for (const level of COMPAT_LEVELS) cells[level] = cellOf(same.filter((r) => r.level === level));
      rows.push({ tool, version, model, cells });
    }
  }
  return rows;
}

/** One table per task, `deliver` first. */
export function tablesOf(runs: readonly CompatRun[]): TaskTable[] {
  const tasks = [...new Set(runs.map(taskOf))].sort((a, b) =>
    a === "deliver" ? -1 : b === "deliver" ? 1 : a.localeCompare(b)
  );
  return tasks.map((task) => ({ task, rows: rowsOf(runs.filter((r) => taskOf(r) === task)) }));
}

/** The first matrix's shape, kept for its readers: the rows of `deliver`. */
export function matrixOf(runs: readonly CompatRun[]): MatrixRow[] {
  return rowsOf(runs.filter((r) => taskOf(r) === "deliver"));
}

/** Levels at which a tool delivered every run and never used the integration (REQ-724). */
export function deliveredWithoutUse(tables: readonly TaskTable[]): string[] {
  const out: string[] = [];
  for (const t of tables)
    for (const row of t.rows) {
      for (const level of ["L2", "L3"] as const) {
        const c = row.cells[level];
        if (c.colour !== "green") continue;
        if (c.mcpCalls === 0 && (level === "L2" || c.refusals === 0))
          out.push(`${row.tool} ${row.model} ${level} on ${t.task}`);
      }
    }
  return out;
}

/** REQ-725: the model to run next for a cell — null at green, at the last model, or off the ladder. */
export function nextModel(tool: CompatTool, runs: readonly CompatRun[]): string | null {
  const ladder = MODEL_LADDER[tool];
  const ran = runs.filter(valid);
  if (ran.length === 0) return ladder[0]!;
  let top = -1;
  for (const r of ran) top = Math.max(top, ladder.indexOf(r.model));
  if (top < 0) return null;
  if (cellOf(ran.filter((r) => r.model === ladder[top])).colour === "green") return null;
  return ladder[top + 1] ?? null;
}

export interface Cheapest {
  tool: CompatTool;
  task: string;
  /** The cheapest model whose cell is green, at B and at the tool's highest level; null: none was. */
  bare: string | null;
  withSpecgate: string | null;
  /** Cost over the runs that passed, at the highest level, when stated. */
  costPerDelivered: number | null;
}

export function cheapestOf(runs: readonly CompatRun[]): Cheapest[] {
  const out: Cheapest[] = [];
  for (const table of tablesOf(runs)) {
    for (const tool of COMPAT_TOOLS) {
      const rows = table.rows.filter((r) => r.tool === tool);
      if (rows.length === 0) continue;
      const top = highestLevel(tool);
      const first = (level: CompatLevel) => rows.find((r) => r.cells[level].colour === "green")?.model ?? null;
      const measured = rows.filter((r) => r.cells[top].runs > 0);
      const cost = measured.every((r) => r.cells[top].cost !== null) && measured.length > 0
        ? measured.reduce((n, r) => n + (r.cells[top].cost as number), 0)
        : null;
      const delivered = measured.reduce((n, r) => n + r.cells[top].passed, 0);
      out.push({
        tool,
        task: table.task,
        bare: first("B"),
        withSpecgate: first(top),
        costPerDelivered: cost !== null && delivered > 0 ? Math.round((cost / delivered) * 10000) / 10000 : null,
      });
    }
  }
  return out;
}

const MARK: Record<CellColour, string> = { green: "🟢", amber: "🟠", red: "🔴", "n/a": "—" };

function cellText(c: Cell, level: CompatLevel): string {
  if (c.runs === 0) return c.invalid > 0 ? `— (${c.invalid} invalid)` : "—";
  const use: string[] = [];
  if (c.stopped > 0) use.push(`stopped ${c.stopped}`);
  if (c.invalid > 0) use.push(`${c.invalid} invalid`);
  if ((level === "L2" || level === "L3" || level === "M") && c.mcpCalls !== null) use.push(`mcp ${c.mcpCalls}`);
  if (level === "L3" && c.refusals !== null) use.push(`refused ${c.refusals}`);
  return `${MARK[c.colour]} ${c.passed}/${c.runs} · ${c.medianSeconds} s${use.length ? ` · ${use.join(", ")}` : ""}`;
}

export function matrixMarkdown(tables: readonly TaskTable[], date: string, cheapest: readonly Cheapest[] = []): string {
  const out = [
    "# Specgate compatibility — internal",
    "",
    `Measured ${date}. A run passes by its task's verdict: \`specgate check\`, a hidden check, the specification left as it was.`,
    "Green: every run passed · amber: some · red: none · —: not run, or the tool has no form for the level.",
    "",
    "B no Specgate · L0 rules (AGENTS.md) · L1 + skills or commands · L2 + MCP · L3 + plugin · M rules + MCP and no shell.",
    "Use is apart from delivery: `mcp n` is the median of calls Specgate's server received, `refused n` of writes its plugin refused.",
    "",
  ];
  for (const t of tables) {
    out.push(`## ${t.task}`, "");
    out.push(`| Tool | Version | Model | ${COMPAT_LEVELS.join(" | ")} | Test first |`);
    out.push(`|---|---|---|${COMPAT_LEVELS.map(() => "---").join("|")}|---|`);
    for (const r of t.rows) {
      const tf = COMPAT_LEVELS.reduce(
        (n, l) => ({ yes: n.yes + r.cells[l].testFirst.yes, of: n.of + r.cells[l].testFirst.of }),
        { yes: 0, of: 0 }
      );
      out.push(
        `| ${r.tool} | ${r.version} | ${r.model} | ${COMPAT_LEVELS.map((l) => cellText(r.cells[l], l)).join(" | ")} | ${tf.of ? `${tf.yes}/${tf.of}` : "—"} |`
      );
    }
    out.push("");
  }
  const unused = deliveredWithoutUse(tables);
  if (unused.length > 0) {
    out.push("## Delivered without using it", "");
    for (const u of unused) out.push(`- ${u}`);
    out.push("");
  }
  const laddered = cheapest.filter((c) => c.bare !== null || c.withSpecgate !== null);
  if (laddered.length > 0) {
    out.push("## Cheapest green model", "");
    out.push("| Tool | Task | Without Specgate (B) | With Specgate (highest level) | Cost per delivered requirement |");
    out.push("|---|---|---|---|---|");
    for (const c of laddered)
      out.push(
        `| ${c.tool} | ${c.task} | ${c.bare ?? "none green"} | ${c.withSpecgate ?? "none green"} | ${c.costPerDelivered === null ? "—" : `$${c.costPerDelivered}`} |`
      );
    out.push("");
  }
  return out.join("\n");
}

/** compat-honest REQ-732: what a release still lacks — nothing when every tool has valid, passed runs of this Specgate at L0 on `deliver`. */
export function releaseGaps(runs: readonly CompatRun[], version: string): string[] {
  const gaps: string[] = [];
  for (const tool of COMPAT_TOOLS) {
    const mine = runs.filter((r) => r.tool === tool && r.level === "L0" && taskOf(r) === "deliver" && r.specgate === version && valid(r));
    if (mine.length === 0) gaps.push(`${tool}: not examined with Specgate ${version}`);
    else if (!mine.every(runPassed)) gaps.push(`${tool}: L0 on deliver is not green — ${mine.filter(runPassed).length}/${mine.length}`);
  }
  return gaps;
}
