#!/usr/bin/env node
/**
 * `specgate agents init --tool <names>` — wire the spec-driven loop into the agent
 * tools a team already uses.
 *
 * One definition of the steps (`./commands`), rendered into each tool's
 * own convention. The generated files are thin on purpose: they tell the agent
 * to run `specgate change instructions`, they do not restate the rules. A markdown
 * file that copies the delta grammar is out of date the moment the grammar
 * moves; a file that calls the engine never is.
 */

import { agentCommand, preferredAgent } from "../cli/commands/project/readiness";
import {
  readHarnessConfig,
  writeHarnessCommand,
} from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { ensureContract } from "./contract-file";
import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../lib/project-root";
import { error, warning, errorMessage } from "../lib/diagnostics";
import { agentIo, wantsJson, EXIT, AgentIo } from "../lib/agent";
import type { Diagnostic } from "../lib/diagnostics";
import { STEPS, PROJECT_RULES, AgentStep } from "./commands";
import {
  SHARED_SKILLS_DIR,
  pluginManifests,
  skillDirsFor,
  skillFiles,
  writeSkills,
} from "./skills";

import { c } from "../lib/ui";
import * as ui from "../lib/ui";

/**
 * The name every generated agent file uses: `/specgate:apply`,
 * `.cursor/rules/specgate.mdc` — the same name people type in the terminal.
 */
export const AGENT_NAMESPACE = "specgate";

// ── Renderers, one per tool convention ────────────────────────────────────────

export function slashCommandBody(step: AgentStep): string {
  // A step that takes an argument gets it from the host: `/specgate:draft
  // curriculum` runs `specgate draft curriculum`, and a bare
  // `/specgate:draft` runs `specgate draft`, which lists the modules.
  const hint = step.argumentHint;
  const run = hint
    ? step.run.filter((r) => r.includes(hint)).map((r) => r.replace(hint, "$ARGUMENTS"))
    : step.run;
  return [
    "---",
    `description: ${step.summary}`,
    ...(hint ? [`argument-hint: ${hint}`] : []),
    "---",
    "",
    `# /${AGENT_NAMESPACE}:${step.name}`,
    "",
    step.summary,
    "",
    `**Use when:** ${step.when}`,
    "",
    "## Run",
    "",
    "```bash",
    ...run,
    "```",
    "",
    "## Guidance",
    "",
    ...step.guidance.map((g) => `- ${g}`),
    "",
    "> The authoritative rules come from `specgate change instructions <artifact> --json`.",
    "> If this file and the engine disagree, the engine is right — say so and continue.",
    "",
  ].join("\n");
}

export function instructionsBody(title: string): string {
  return [
    `# ${title}`,
    "",
    "This project uses Spec-Driven Development through the `specgate` CLI.",
    "Requirements, scenarios and traceability are executable artefacts, not documentation.",
    "",
    "## Non-negotiables",
    "",
    ...PROJECT_RULES.map((r) => `- ${r}`),
    "",
    "## The loop",
    "",
    ...STEPS.flatMap((s) => [
      `### ${s.name} — ${s.summary}`,
      "",
      `Use when: ${s.when}`,
      "",
      "```bash",
      ...s.run,
      "```",
      "",
    ]),
    "## Where the rules live",
    "",
    "Do not memorise the artefact formats. `specgate change instructions <proposal|specs|design|tasks|apply|archive> --json`",
    "returns the template, the rules the validator enforces, the project's declared",
    "stack and what writing the artefact unblocks. It is the single source; this",
    "file is a pointer to it.",
    "",
  ].join("\n");
}

function cursorRuleBody() {
  return [
    "---",
    "description: Spec-driven development rules for this repository",
    "alwaysApply: true",
    "---",
    "",
    ...PROJECT_RULES.map((r) => `- ${r}`),
    "",
    "Run `specgate change instructions <artifact> --json` for the format of any artefact.",
    "",
  ].join("\n");
}

/** The CLI's version, stamped into the plugin manifest. */
function cliVersion(): string {
  try {
    // The path is computed at run time — it differs between `scripts/` and the
    // compiled `dist/scripts/` — and an `import` specifier must be static.
    return require(path.resolve(__dirname, "..", "..", "..", "package.json")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * The Claude Code plugin: the steps as slash commands, the MCP server, and
 * the gate as a `Stop` hook.
 *
 * The hook is the part no other target can offer. Every other tool here gets
 * *instructions* — text an agent may or may not follow. A plugin gets a hook,
 * which runs whether the agent likes it or not, so `validate --strict`
 * stops being something that reviews the work after the agent has gone and
 * becomes something the agent cannot walk past.
 *
 * Generated from the same `STEPS` as every other target, so the commands
 * cannot drift from the ones Cursor or Copilot are told about. Verified
 * against the plugin reference: `.claude-plugin/plugin.json` is the manifest
 * and every component directory sits at the plugin root, never inside it.
 */
function claudePluginFiles(version: string) {
  const manifest = {
    name: AGENT_NAMESPACE,
    displayName: "Spec-Driven Development",
    description:
      "Specs as executable contracts: the daily loop as commands, the spec tree over MCP, " +
      "the test before the code, and the gate as a hook that runs before the session can end.",
    version,
    license: "MIT",
    keywords: ["spec-driven-development", "sdd", "gherkin", "traceability"],
    homepage: "https://rsaglobaltech.github.io/specgate/",
    repository: "https://github.com/rsaglobaltech/specgate",
    author: { name: "RSA Global Tech", url: "https://github.com/rsaglobaltech" },
  };

  const run = (script: string) => [
    { hooks: [{ type: "command", command: `node "\${CLAUDE_PLUGIN_ROOT}/scripts/${script}"` }] },
  ];
  const hooks = {
    hooks: {
      // A new session is told the open change and what comes next (REQ-420).
      SessionStart: run("session-hook.js"),
      // An edit to source code waits for a test that names the requirement (REQ-421).
      PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit|Bash", ...run("guard-hook.js")[0] }],
      Stop: run("gate-hook.js"),
    },
  };

  // Tessl reads the plugin's `.mcp.json` and wants each server's transport named;
  // Claude Code reads `type: "stdio"` the same as no type.
  const base = mcpServerConfig();
  const mcp = {
    mcpServers: Object.fromEntries(
      Object.entries(base.mcpServers).map(([k, v]) => [k, { type: "stdio", ...v }])
    ),
  };

  return [
    { path: path.join(".claude-plugin", "plugin.json"), contents: json(manifest) },
    // REQ-550: the Agent Plugins and Tessl manifests, and the skills they list.
    ...pluginManifests(manifest),
    ...skillFiles("skills"),
    { path: path.join("hooks", "hooks.json"), contents: json(hooks) },
    { path: ".mcp.json", contents: json(mcp) },
    ...STEPS.map((s) => ({
      path: path.join("commands", AGENT_NAMESPACE, `${s.name}.md`),
      contents: slashCommandBody(s),
    })),
    ...PLUGIN_SCRIPTS.map((name) => ({
      path: path.join("scripts", name),
      contents: pluginScriptSource(name),
    })),
    { path: "README.md", contents: pluginReadme() },
  ];
}

/**
 * The hook, bundled into the plugin.
 *
 * A plugin is installed on its own — there is no guarantee the CLI that
 * generated it is anywhere near the machine that runs it — so the script has
 * to travel with it. It is copied from the compiled source rather than written
 * out again here, because a second copy of this logic is a second thing to keep
 * correct.
 */
function pluginScriptSource(name: string): string {
  const compiled = path.resolve(__dirname, "..", "plugin", name);
  if (!fs.existsSync(compiled)) {
    throw new Error(
      `The plugin's ${name} is not built: ${compiled} is missing.\n` +
        "Fix: run `npm run build` before generating the plugin."
    );
  }
  return fs.readFileSync(compiled, "utf8");
}

/** The first line of every OpenCode plugin file Specgate generates: what tells its own from one written by hand. */
export const OPENCODE_PLUGIN_MARK = "// Generated by `specgate agents init --tool opencode-plugin`. Do not edit by hand.";

/** Where Specgate wrote the plugin for OpenCode 1, under an OpenCode config folder: taken away when the new one is written (REQ-727). */
export const OPENCODE_PLUGIN_V1 = path.join("plugin", `${AGENT_NAMESPACE}.js`);

/**
 * The OpenCode plugin (REQ-422, REQ-727), under an OpenCode config folder: the
 * project's `.opencode/`, or the user's global one. OpenCode 2 loads each
 * folder of `plugins/` whose `index.js` default-exports a definition with an
 * id and a setup function; the scripts it requires sit beside that folder, as
 * `.cjs` so they stay CommonJS whatever a `package.json` there says about
 * modules.
 */
export function opencodePluginFiles(base: string): AgentFile[] {
  const plugin = [
    OPENCODE_PLUGIN_MARK,
    "// The open change in the session, the test before the code, and the gate (REQ-422, REQ-728).",
    'import { Plugin } from "@opencode/plugin";',
    'import { createRequire } from "node:module";',
    "",
    "const require = createRequire(import.meta.url);",
    'const { setupV2 } = require("../../specgate/opencode-bridge.cjs");',
    "",
    `export default Plugin.define({ id: "${AGENT_NAMESPACE}", setup: (ctx) => setupV2(ctx) });`,
    "",
  ].join("\n");
  return [
    { path: path.join(base, "plugins", AGENT_NAMESPACE, "index.js"), contents: plugin },
    ...OPENCODE_SCRIPTS.map((name) => ({
      path: path.join(base, AGENT_NAMESPACE, name.replace(/\.js$/, ".cjs")),
      contents: pluginScriptSource(name).replace(
        /require\("\.\/([\w-]+)"\)/g,
        'require("./$1.cjs")'
      ),
    })),
  ];
}

/** REQ-727: the plugin an earlier Specgate generated for OpenCode 1 is removed; one written by hand is left. True when it was removed. */
export function removeOpencodePluginV1(configDir: string): boolean {
  const old = path.join(configDir, OPENCODE_PLUGIN_V1);
  try {
    if (!fs.readFileSync(old, "utf8").startsWith(OPENCODE_PLUGIN_MARK)) return false;
    fs.rmSync(old);
    const folder = path.dirname(old);
    if (fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
    return true;
  } catch {
    return false;
  }
}

/**
 * The `description` of every `.codex/hooks.json` Specgate writes: what tells its own from one a person wrote.
 * Codex refuses any other top-level key than `description` and `hooks` (measured, 0.154).
 */
export const CODEX_HOOKS_MARK = "Generated by `specgate agents init --tool codex-hooks`. Do not edit by hand.";
export const CODEX_HOOKS_FILE = path.join(".codex", "hooks.json");

/**
 * codex-guard REQ-751: Codex's project hooks, in Claude Code's shape — the
 * session hears the open change, a shell command or a patch waits on the guard,
 * the gate speaks when the agent stops. The scripts travel with the project, as
 * `.cjs` so they stay CommonJS whatever a `package.json` says about modules.
 */
export function codexHookFiles(): AgentFile[] {
  const run = (name: string) => [
    { type: "command", command: `node .codex/${AGENT_NAMESPACE}/${name.replace(/\.js$/, ".cjs")}` },
  ];
  const hooks = {
    description: CODEX_HOOKS_MARK,
    hooks: {
      SessionStart: [{ hooks: run("session-hook.js") }],
      PreToolUse: [{ matcher: "Bash|apply_patch", hooks: run("guard-hook.js") }],
      Stop: [{ hooks: run("gate-hook.js") }],
    },
  };
  return [
    { path: CODEX_HOOKS_FILE, contents: json(hooks) },
    ...PLUGIN_SCRIPTS.map((name) => ({
      path: path.join(".codex", AGENT_NAMESPACE, name.replace(/\.js$/, ".cjs")),
      contents: pluginScriptSource(name).replace(/require\("\.\/([\w-]+)"\)/g, 'require("./$1.cjs")'),
    })),
  ];
}

/** True when the project's `.codex/hooks.json` is there and Specgate did not write it. */
export function codexHooksByPerson(projectDir: string): boolean {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(projectDir, CODEX_HOOKS_FILE), "utf8"));
    return !(doc && typeof doc === "object" && doc.description === CODEX_HOOKS_MARK);
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

/** The compiled scripts the OpenCode plugin requires. */
const OPENCODE_SCRIPTS = [
  "opencode-bridge.js",
  "guard-hook.js",
  "session-hook.js",
  "gate-hook.js",
  "project-state.js",
  "person-acts.js",
];

/** The compiled scripts the plugin carries: the hooks, and the helper they share. */
const PLUGIN_SCRIPTS = ["gate-hook.js", "session-hook.js", "guard-hook.js", "project-state.js", "person-acts.js"];

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

function pluginReadme(): string {
  return [
    `# ${AGENT_NAMESPACE} — Claude Code plugin`,
    "",
    "Generated by `specgate agents init --tool claude-plugin`. Do not edit by hand:",
    "the commands come from the same definition every other agent tool is",
    "wired from, so editing here makes them drift.",
    "",
    "## What it adds",
    "",
    `- **${STEPS.length} slash commands** — ${STEPS.map((s) => `\`/${AGENT_NAMESPACE}:${s.name}\``).join(", ")}.`,
    "- **The spec tree over MCP** — read specs, list requirements and run",
    "  `validate` as tools rather than by scraping terminal output.",
    "- **The open change at session start** — a `SessionStart` hook tells the",
    "  session the project is spec-driven, the open change and its next requirement.",
    "- **The test before the code** — a `PreToolUse` hook refuses a write to a",
    "  source file until a test new or changed in the working tree names a",
    "  requirement of an open change (`specgate config set agent_guard off` to turn",
    "  it off for a project, `SPECGATE_GUARD=off` for a session).",
    "- **The gate as a `Stop` hook** — `specgate validate --strict` runs when the",
    "  session is about to end, and refuses the stop while it is red.",
    "",
    "Install it once for every project: `specgate agents install --global` prints",
    "the two `/plugin` commands.",
    "",
    "## The hook, and why it does not trap you",
    "",
    "It blocks **once per prompt**. The second time the same prompt reaches the",
    "hook it reports the findings and lets the session end: by then the agent has",
    "been told, and a human needs to see the answer more than the loop needs",
    "another turn. A project with no `spec.md`, or a machine with no `specgate` on",
    "PATH, is left alone entirely.",
    "",
  ].join("\n");
}

/**
 * How a host is told to start the Specgate MCP server.
 *
 * The same object for every host, because the format is the same one: Claude
 * Code reads it from `.mcp.json`, Antigravity from `.agents/mcp_config.json`.
 * Written once so the two cannot drift into describing different servers.
 */
export function mcpServerConfig() {
  return {
    mcpServers: {
      "spec-driven": { command: "npx", args: ["-y", "@rsaglobaltech/specgate", "mcp", "serve"] },
    },
  };
}

/** A file an agent tool reads, relative to the project root. */
export interface AgentFile {
  path: string;
  contents: string;
}

/** One agent tool: what to call it, and the files it expects. */
export interface AgentTool {
  label: string;
  /** Left out of the default `--tool` set; installed only when named. */
  optIn?: boolean;
  files: () => AgentFile[];
}

/**
 * What each tool expects, and where.
 *
 * Adding a tool is one row: the loop below does not know any tool's name.
 */
export const TOOLS: Record<string, AgentTool> = {
  claude: {
    label: "Claude Code",
    files: () => [
      ...STEPS.map((s) => ({
        path: path.join(".claude", "commands", AGENT_NAMESPACE, `${s.name}.md`),
        contents: slashCommandBody(s),
      })),
      { path: "AGENTS.md", contents: instructionsBody("Agent instructions") },
    ],
  },
  "claude-plugin": {
    label: "Claude Code plugin",
    // Opt-in: a plugin is an installable artefact, not something to scatter
    // into every project that ran `agents init`.
    optIn: true,
    files: () => claudePluginFiles(cliVersion()),
  },
  "codex-hooks": {
    label: "Codex hooks",
    // Opt-in, like the plugins: it runs code in the agent's loop, and Codex asks the person to trust it.
    optIn: true,
    files: () => codexHookFiles(),
  },
  "opencode-plugin": {
    label: "OpenCode plugin",
    // Opt-in, like the Claude Code plugin: it runs code in the agent's loop.
    optIn: true,
    files: () => opencodePluginFiles(path.join(".opencode")),
  },
  cursor: {
    label: "Cursor",
    files: () => [
      { path: path.join(".cursor", "rules", `${AGENT_NAMESPACE}.mdc`), contents: cursorRuleBody() },
    ],
  },
  copilot: {
    label: "GitHub Copilot",
    files: () => [
      {
        path: path.join(".github", "copilot-instructions.md"),
        contents: instructionsBody("Copilot instructions"),
      },
    ],
  },
  windsurf: {
    label: "Windsurf",
    files: () => [
      {
        path: path.join(".windsurf", "rules", `${AGENT_NAMESPACE}.md`),
        contents: cursorRuleBody(),
      },
    ],
  },
  aider: {
    label: "Aider",
    files: () => [{ path: "CONVENTIONS.md", contents: instructionsBody("Conventions") }],
  },
  gemini: {
    label: "Gemini CLI",
    files: () => [{ path: "GEMINI.md", contents: instructionsBody("Agent instructions") }],
  },
  cline: {
    label: "Cline",
    files: () => [
      { path: path.join(".clinerules", `${AGENT_NAMESPACE}.md`), contents: cursorRuleBody() },
    ],
  },
  codex: {
    label: "Codex",
    files: () => [{ path: "AGENTS.md", contents: instructionsBody("Agent instructions") }],
  },
  opencode: {
    label: "OpenCode",
    // OpenCode reads AGENTS.md itself; its commands are Markdown files under
    // `.opencode/commands/`, invoked by file name (`/specgate-draft`), with a
    // `description` in the front matter and `$ARGUMENTS` for what follows.
    files: () => [
      ...STEPS.map((s) => ({
        path: path.join(".opencode", "commands", `${AGENT_NAMESPACE}-${s.name}.md`),
        contents: slashCommandBody(s).replace(
          `# /${AGENT_NAMESPACE}:${s.name}`,
          `# /${AGENT_NAMESPACE}-${s.name}`
        ),
      })),
      { path: "AGENTS.md", contents: instructionsBody("Agent instructions") },
    ],
  },
  antigravity: {
    label: "Antigravity",
    // Two files, because Antigravity reads both halves of what Specgate offers:
    // workspace rules, and a live MCP connection to the project's own specs.
    //
    // Paths are the ones its documentation states — `.agents/rules/` (it still
    // accepts the older `.agent/rules`, singular, which is why the plural is
    // written deliberately here) and `.agents/mcp_config.json`, which the IDE
    // and the CLI both discover. Its docs also cap a rule file at 12,000
    // characters; `cursorRuleBody()` is an order of magnitude under, and a test
    // keeps it that way.
    //
    // Its own `GEMINI.md` convention is already covered by the `gemini` row,
    // and third-party guides say it reads `AGENTS.md` too — but its
    // documentation does not, so nothing here depends on that.
    files: () => [
      { path: path.join(".agents", "rules", `${AGENT_NAMESPACE}.md`), contents: cursorRuleBody() },
      { path: path.join(".agents", "mcp_config.json"), contents: json(mcpServerConfig()) },
    ],
  },
};

export const ALL_TOOLS = Object.keys(TOOLS);

/**
 * Slash commands renamed after they shipped, as [old path, new path].
 * `specgate update` moves them — file and baseline — before it merges, so a
 * team's edits survive the rename instead of being stranded in a file nothing
 * updates any more.
 */
export function renamedPaths(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const tool of ALL_TOOLS) {
    for (const file of TOOLS[tool].files()) {
      const parts = file.path.split(path.sep);
      for (const [was, now] of RENAMED_COMMANDS) {
        if (parts[parts.length - 1] !== `${now}.md`) continue;
        const before = path.join(path.dirname(file.path), `${was}.md`);
        if (!seen.has(before)) {
          seen.add(before);
          pairs.push([before, file.path]);
        }
      }
    }
  }
  return pairs;
}

/** Slash commands renamed after they shipped: [old name, new name]. */
export const RENAMED_COMMANDS: ReadonlyArray<[string, string]> = [["verify", "check"]];

/** What `--tool` defaults to: everything that belongs inside a project. */
export const DEFAULT_TOOLS = ALL_TOOLS.filter((t) => !TOOLS[t].optIn);

/** Parsed command-line options for this command. */
export interface AgentsInitOptions {
  tools: string[];
  projectDir: string;
  dryRun: boolean;
  force: boolean;
  json: boolean;
  /** REQ-549: `skills` writes Agent Skills folders instead of each tool's commands. */
  format: "commands" | "skills";
  /** The tools as named with --tool; null when none was named. */
  named: string[] | null;
  help?: boolean;
  unknown?: string;
  badFormat?: string;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🤖 agents init${c.reset}  ${c.dim}— wire the loop into your agent tools${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    specgate agents init [--tool <names>] [--project-dir <path>] [--dry-run] [--force] [--json]\n` +
      `    specgate agents init --format skills [--tool claude|cursor|gemini] [--force]\n\n` +
      `  ${c.bold}TOOLS${c.reset}\n` +
      `    ${ALL_TOOLS.join(", ")}${c.dim}  (default: all but claude-plugin, codex-hooks, opencode-plugin)${c.reset}\n\n` +
      `  ${c.bold}NOTES${c.reset}\n` +
      `    ${c.dim}Existing files are never overwritten without --force.${c.reset}\n` +
      `    ${c.dim}--dry-run lists what would be written and touches nothing.${c.reset}\n` +
      `    ${c.dim}--format skills writes the loop as Agent Skills into .agents/skills/ and the${c.reset}\n` +
      `    ${c.dim}named (or present) tool's own folder; a SKILL.md changed by hand is kept.${c.reset}\n\n`
  );
}

export function parseArgs(argv: string[]): AgentsInitOptions {
  const opts: AgentsInitOptions = {
    tools: DEFAULT_TOOLS,
    projectDir: ".",
    dryRun: false,
    force: false,
    json: false,
    format: "commands",
    named: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tool" && argv[i + 1]) {
      opts.tools = argv[++i]
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      opts.named = opts.tools;
    } else if (a === "--format" && argv[i + 1]) {
      const f = argv[++i];
      if (f === "skills" || f === "commands") opts.format = f;
      else opts.badFormat = f;
    } else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("-")) opts.unknown = a;
  }
  return opts;
}

/** A file `writeAgentFiles` wrote, or would write on a dry run. */
export interface WrittenAgentFile {
  /** The tools that asked for it, joined with `+`. */
  tool: string;
  path: string;
}

/** A file `writeAgentFiles` left alone, and why. */
export interface SkippedAgentFile extends WrittenAgentFile {
  reason: string;
}

/**
 * Write the files for `tools` into `projectDir`. An existing file is left
 * untouched unless `force`. Shared by `agents init` and by `init`/`adopt`,
 * which install for the agents they detect.
 */
/** Where `--tool claude-plugin` writes inside a Specgate project: hidden, so the guard never reads it as source. */
export const PLUGIN_IN_PROJECT = path.join(".claude", "specgate-plugin");

function isSpecgateProject(dir: string): boolean {
  return fs.existsSync(path.join(dir, "spec.md")) || fs.existsSync(path.join(dir, "docs", "specs"));
}

export function writeAgentFiles(
  projectDir: string,
  tools: string[],
  opts: { force?: boolean; dryRun?: boolean } = {}
): { written: WrittenAgentFile[]; skipped: SkippedAgentFile[]; diagnostics: Diagnostic[] } {
  const written: WrittenAgentFile[] = [];
  const skipped: SkippedAgentFile[] = [];
  const diagnostics: Diagnostic[] = [];

  // Several tools share a destination — Claude and Codex both read AGENTS.md —
  // so a file is written once and attributed to the tools that asked for it.
  const planned = new Map<string, AgentFile & { tools: string[] }>();
  // walkthrough-fixes-2: a plugin generated inside a Specgate project goes to a
  // folder of its own, under `.claude/` — at the root its scripts read as the
  // project's untested source, and the guard then held back every call.
  const pluginHome = isSpecgateProject(projectDir) ? PLUGIN_IN_PROJECT : "";
  for (const tool of tools) {
    for (const raw of TOOLS[tool].files()) {
      const file = tool === "claude-plugin" && pluginHome ? { ...raw, path: path.join(pluginHome, raw.path) } : raw;
      const entry = planned.get(file.path);
      if (entry) entry.tools.push(tool);
      else planned.set(file.path, { ...file, tools: [tool] });
    }
  }

  {
    for (const file of planned.values()) {
      const tool = file.tools.join("+");
      // AGENTS.md is shared with the team and other tools: Specgate owns a
      // marked block in it, never the whole file (ADR-0031).
      if (file.path === "AGENTS.md") {
        const done = ensureContract(projectDir, { dryRun: opts.dryRun });
        if (done) written.push({ tool, path: file.path });
        else skipped.push({ tool, path: file.path, reason: "has the specgate block" });
        continue;
      }
      const target = path.join(projectDir, file.path);
      const exists = fs.existsSync(target);

      // codex-guard REQ-751: hooks a person wrote are theirs, --force or not.
      if (file.path === CODEX_HOOKS_FILE && codexHooksByPerson(projectDir)) {
        skipped.push({ tool, path: file.path, reason: "written by a person" });
        diagnostics.push(
          warning("codex_hooks_kept", `${file.path} was not written by Specgate — kept as it is.`, {
            file: file.path,
            fix: "Add Specgate's hooks to it by hand: SessionStart → node .codex/specgate/session-hook.cjs, PreToolUse on Bash|apply_patch → node .codex/specgate/guard-hook.cjs, Stop → node .codex/specgate/gate-hook.cjs.",
          })
        );
        continue;
      }

      if (exists && !opts.force) {
        skipped.push({ tool, path: file.path, reason: "exists" });
        diagnostics.push(
          warning("agent_file_exists", `${file.path} already exists — left untouched.`, {
            file: file.path,
            fix: "Pass --force to overwrite it, or merge the generated content by hand.",
          })
        );
        continue;
      }

      if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.contents, "utf8");
        if (file.tools.includes("opencode-plugin") && file.path.endsWith(path.join("plugins", AGENT_NAMESPACE, "index.js")))
          removeOpencodePluginV1(path.join(projectDir, ".opencode"));
      }
      written.push({ tool, path: file.path });
    }
  }

  return { written, skipped, diagnostics };
}

/** `agents init --format skills` (REQ-549). */
function skillsMain(io: AgentIo, projectDir: string, opts: AgentsInitOptions): void {
  const dirs = skillDirsFor(projectDir, opts.named);
  const r = writeSkills(projectDir, dirs, { force: opts.force, dryRun: opts.dryRun });
  io.emit(
    {
      agents: {
        projectDir,
        format: "skills",
        dirs: dirs.map((d) => d.split(path.sep).join("/")),
        dryRun: opts.dryRun,
        written: r.written,
        unchanged: r.unchanged,
        kept: r.kept,
      },
      status: r.diagnostics,
    },
    () => {
      process.stdout.write(ui.header("agents init --format skills", dirs.join(", ")));
      const verb = opts.dryRun ? "would write" : "";
      for (const w of r.written) process.stdout.write(ui.fileLine("added", w, verb));
      for (const k of r.kept) {
        process.stdout.write(`    ${ui.muted(`= ${k}   changed by hand, kept`)}\n`);
      }
      if (r.unchanged.length > 0) {
        process.stdout.write(`    ${ui.muted(`${r.unchanged.length} skill(s) already current`)}\n`);
      }
      if (r.kept.length > 0) {
        process.stdout.write(`\n  ${ui.muted("Pass --force to replace the kept skills.")}\n`);
      }
      process.stdout.write("\n");
    }
  );
  process.exit(EXIT.OK);
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  const io: AgentIo = agentIo(opts.json || wantsJson(argv));
  const NULL_SHAPE = { agents: null };

  if (opts.help) {
    usage();
    process.exit(EXIT.OK);
  }
  if (opts.unknown) {
    io.usage(NULL_SHAPE, [
      error("unknown_flag", `Unknown flag: ${opts.unknown}`, {
        target: opts.unknown,
        fix: "Run `specgate agents init --help` for the accepted flags.",
      }),
    ]);
  }

  if (opts.badFormat) {
    io.usage(NULL_SHAPE, [
      error("format_unknown", `Unknown format: ${opts.badFormat}`, {
        target: opts.badFormat,
        fix: "specgate agents init --format skills",
      }),
    ]);
  }

  const unsupported = opts.tools.filter((t) => !TOOLS[t]);
  if (unsupported.length > 0) {
    io.usage(NULL_SHAPE, [
      error("tool_unknown", `Unknown tool(s): ${unsupported.join(", ")}`, {
        target: unsupported.join(","),
        fix: `Supported: ${ALL_TOOLS.join(", ")}.`,
      }),
    ]);
  }

  let projectDir;
  try {
    projectDir = resolveProjectDir(opts.projectDir);
  } catch (err) {
    io.usage(NULL_SHAPE, [
      error("project_not_found", errorMessage(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }

  if (opts.format === "skills") return skillsMain(io, projectDir, opts);

  const { written, skipped, diagnostics } = writeAgentFiles(projectDir, opts.tools, {
    force: opts.force,
    dryRun: opts.dryRun,
  });

  // REQ-597: Codex has no per-project slash commands; it reads skills from
  // .agents/skills/. Named, or the project carrying .codex/, it gets the same
  // steps Claude Code and OpenCode get — without knowing about --format skills.
  const codexWanted =
    opts.tools.includes("codex") &&
    ((opts.named || []).includes("codex") || fs.existsSync(path.join(projectDir, ".codex")));
  if (codexWanted) {
    const skills = writeSkills(projectDir, [SHARED_SKILLS_DIR], {
      force: opts.force,
      dryRun: opts.dryRun,
    });
    written.push(...skills.written.map((p) => ({ tool: "codex", path: p })));
    diagnostics.push(...skills.diagnostics);
  }

  // One command sets up the agent (REQ-473): its commands, and the agent Build
  // runs when none is set yet — never over one a person chose.
  let agentSet: string | null = null;
  if (!opts.dryRun && !readHarnessConfig(projectDir)?.agent) {
    // REQ-596: the tool named first, when named; otherwise the agent this
    // project uses — not Claude for every project that installs every tool.
    const tool = opts.named
      ? opts.tools.find((t) => agentCommand(t))
      : preferredAgent(projectDir, opts.tools);
    const command = tool ? agentCommand(tool) : null;
    if (command) {
      writeHarnessCommand(projectDir, "agent", command);
      agentSet = command;
    }
  }

  io.emit(
    {
      agents: {
        projectDir,
        tools: opts.tools,
        dryRun: opts.dryRun,
        written,
        skipped,
        agent: agentSet,
      },
      status: diagnostics,
    },
    () => {
      const verb = opts.dryRun ? "would write" : "wrote";
      process.stdout.write(ui.header("agents init", opts.tools.join(", ")));
      for (const w of written) {
        process.stdout.write(ui.fileLine("added", w.path, opts.dryRun ? verb : ""));
      }
      for (const s of skipped) {
        process.stdout.write(`    ${ui.muted(`= ${s.path}   exists, skipped`)}\n`);
      }
      if (skipped.length > 0) {
        process.stdout.write(`\n  ${ui.muted("Pass --force to overwrite the skipped files.")}\n`);
      }
      if (agentSet) {
        process.stdout.write(
          `\n  ${ui.ok(`Build runs it: agent set in harness.config.yaml — ${ui.muted(agentSet)}`)}\n`
        );
      }
      process.stdout.write(
        "\n" +
          ui.section("Next") +
          // REQ-598: one way to start, the same for every agent.
          `  ${c.cyan}${ui.sym.next}${c.reset}  Paste what ${ui.cmd("specgate status --prompt")} prints into your agent\n` +
          `     ${ui.muted("it says where to start, from the project as it is now, and what the agent never does")}\n\n`
      );
    }
  );
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
