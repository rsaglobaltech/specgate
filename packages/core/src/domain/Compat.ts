/**
 * The compatibility exam (harness-compat REQ-711…REQ-716): which tool gets
 * which integration at each level, a cell's verdict from its runs, and the
 * internal matrix. Pure.
 */

export const COMPAT_TOOLS = ["claude", "codex", "opencode"] as const;
export type CompatTool = (typeof COMPAT_TOOLS)[number];
export const COMPAT_LEVELS = ["L0", "L1", "L2", "L3"] as const;
export type CompatLevel = (typeof COMPAT_LEVELS)[number];

/** The cheapest model of each tool, the default of an exam run. */
export const CHEAPEST_MODEL: Readonly<Record<CompatTool, string>> = {
  claude: "haiku",
  codex: "gpt-5.6-luna",
  opencode: "opencode/big-pickle",
};

/** Provider keys an exam run's agent never sees unless `--keep-env` names them (REQ-714). */
export const PROVIDER_KEYS = ["OPENCODE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const;

/** What a level gives a tool (REQ-712); null when the tool has no form for it. */
export interface LevelIntegration {
  /** `agents init --tool <t>` runs for these, in the copy. */
  agentsInit: string[];
  /** Skills written with `agents init --format skills --tool <t>`. */
  skillsFor: string | null;
  mcp: boolean;
  plugin: boolean;
}

export function integrationOf(tool: CompatTool, level: CompatLevel): LevelIntegration | null {
  if (level === "L3" && tool === "codex") return null;
  const n = COMPAT_LEVELS.indexOf(level);
  return {
    agentsInit: n >= 1 ? [tool] : [],
    skillsFor: n >= 1 && tool === "claude" ? "claude" : null,
    mcp: n >= 2,
    plugin: n >= 3,
  };
}

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
}

/** A run passes only when the gate and the hidden check both passed (REQ-715). */
export const runPassed = (r: CompatRun) => r.ran && r.check && r.hidden;

export type CellColour = "green" | "amber" | "red" | "n/a";

export interface Cell {
  colour: CellColour;
  passed: number;
  runs: number;
  medianSeconds: number | null;
}

export function cellOf(runs: readonly CompatRun[]): Cell {
  const ran = runs.filter((r) => r.ran);
  if (ran.length === 0) return { colour: "n/a", passed: 0, runs: 0, medianSeconds: null };
  const passed = ran.filter(runPassed).length;
  const secs = ran.map((r) => r.seconds).sort((a, b) => a - b);
  const mid = Math.floor(secs.length / 2);
  const medianSeconds =
    secs.length % 2 ? secs[mid]! : Math.round(((secs[mid - 1]! + secs[mid]!) / 2) * 10) / 10;
  const colour: CellColour = passed === ran.length ? "green" : passed > 0 ? "amber" : "red";
  return { colour, passed, runs: ran.length, medianSeconds };
}

export interface MatrixRow {
  tool: CompatTool;
  version: string;
  model: string;
  cells: Record<CompatLevel, Cell>;
}

/** One row per tool that has runs; each cell from its latest version's runs. */
export function matrixOf(runs: readonly CompatRun[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const tool of COMPAT_TOOLS) {
    const mine = runs.filter((r) => r.tool === tool);
    if (mine.length === 0) continue;
    const last = mine[mine.length - 1]!;
    const same = mine.filter((r) => r.version === last.version && r.model === last.model);
    const cells = {} as Record<CompatLevel, Cell>;
    for (const level of COMPAT_LEVELS) cells[level] = cellOf(same.filter((r) => r.level === level));
    rows.push({ tool, version: last.version, model: last.model, cells });
  }
  return rows;
}

const MARK: Record<CellColour, string> = { green: "🟢", amber: "🟠", red: "🔴", "n/a": "—" };

export function matrixMarkdown(rows: readonly MatrixRow[], date: string): string {
  const head = `| Tool | Version | Model | ${COMPAT_LEVELS.join(" | ")} |`;
  const rule = `|---|---|---|${COMPAT_LEVELS.map(() => "---").join("|")}|`;
  const line = (r: MatrixRow) =>
    `| ${r.tool} | ${r.version} | ${r.model} | ${COMPAT_LEVELS.map((l) => {
      const c = r.cells[l];
      return c.colour === "n/a" ? "n/a" : `${MARK[c.colour]} ${c.passed}/${c.runs} · ${c.medianSeconds} s`;
    }).join(" | ")} |`;
  return [
    "# Specgate compatibility — internal",
    "",
    `Measured ${date}. A run passes when \`specgate check\` and the hidden check both pass.`,
    "Green: every run passed · amber: some · red: none · n/a: the tool has no form for the level.",
    "",
    "L0 rules (AGENTS.md) · L1 + skills or commands · L2 + MCP · L3 + plugin.",
    "",
    head,
    rule,
    ...rows.map(line),
    "",
  ].join("\n");
}
