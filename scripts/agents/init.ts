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

import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../lib/project-root";
import { error, warning, errorMessage } from "../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { STEPS, PROJECT_RULES } from "./commands";

const COLOR =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR ? "\x1b[0m" : "",
  bold: COLOR ? "\x1b[1m" : "",
  dim: COLOR ? "\x1b[2m" : "",
  green: COLOR ? "\x1b[32m" : "",
  cyan: COLOR ? "\x1b[36m" : "",
};

/**
 * The name every generated agent file uses: `/specgate:apply`,
 * `.cursor/rules/specgate.mdc`. It was `csda`, the tool's old name, so a team
 * typed one name in the terminal and another in their agent. `specgate update`
 * moves files generated under the old name (`RENAMED_PATHS`).
 */
export const AGENT_NAMESPACE = "specgate";
const OLD_NAMESPACE = "csda";

// ── Renderers, one per tool convention ────────────────────────────────────────

export function slashCommandBody(step) {
  return [
    "---",
    `description: ${step.summary}`,
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
    ...step.run,
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

export function instructionsBody(title) {
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
      "and the gate as a hook that runs before the session can end.",
    version,
    license: "MIT",
    keywords: ["spec-driven-development", "sdd", "gherkin", "traceability"],
    homepage: "https://rsaglobaltech.github.io/specgate/",
  };

  const hooks = {
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `node "\${CLAUDE_PLUGIN_ROOT}/scripts/gate-hook.js"`,
            },
          ],
        },
      ],
    },
  };

  const mcp = mcpServerConfig();

  return [
    { path: path.join(".claude-plugin", "plugin.json"), contents: json(manifest) },
    { path: path.join("hooks", "hooks.json"), contents: json(hooks) },
    { path: ".mcp.json", contents: json(mcp) },
    ...STEPS.map((s) => ({
      path: path.join("commands", AGENT_NAMESPACE, `${s.name}.md`),
      contents: slashCommandBody(s),
    })),
    { path: path.join("scripts", "gate-hook.js"), contents: gateHookSource() },
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
function gateHookSource(): string {
  const compiled = path.resolve(__dirname, "..", "plugin", "gate-hook.js");
  if (!fs.existsSync(compiled)) {
    throw new Error(
      `The gate hook is not built: ${compiled} is missing.\n` +
        "Fix: run `npm run build` before generating the plugin."
    );
  }
  return fs.readFileSync(compiled, "utf8");
}

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
    "- **The gate as a `Stop` hook** — `specgate validate --strict` runs when the",
    "  session is about to end, and refuses the stop while it is red.",
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
      "spec-driven": { command: "npx", args: ["-y", "@specgate/mcp-server"] },
    },
  };
}

/**
 * What each tool expects, and where.
 *
 * Adding a tool is one row: the loop below does not know any tool's name.
 */
export const TOOLS = {
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
 * Where each generated file lived under the old `csda` name, and where it
 * lives now. `specgate update` moves them — file and baseline — before it
 * merges, so a team's edits survive the rename instead of being stranded in a
 * file nothing updates any more.
 */
export function renamedPaths(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const tool of ALL_TOOLS) {
    for (const file of TOOLS[tool].files()) {
      const parts = file.path.split(path.sep);
      const old = parts
        .map((p) =>
          p === AGENT_NAMESPACE
            ? OLD_NAMESPACE
            : p.startsWith(`${AGENT_NAMESPACE}.`)
              ? OLD_NAMESPACE + p.slice(AGENT_NAMESPACE.length)
              : p
        )
        .join(path.sep);
      if (old !== file.path && !seen.has(old)) {
        seen.add(old);
        pairs.push([old, file.path]);
      }
    }
  }
  return pairs;
}

/** What `--tool` defaults to: everything that belongs inside a project. */
export const DEFAULT_TOOLS = ALL_TOOLS.filter((t) => !TOOLS[t].optIn);

/** Parsed command-line options for this command. */
export interface AgentsInitOptions {
  tools: string[];
  projectDir: string;
  dryRun: boolean;
  force: boolean;
  json: boolean;
  help?: boolean;
  unknown?: string;
}

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🤖 agents init${c.reset}  ${c.dim}— wire the loop into your agent tools${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    specgate agents init [--tool <names>] [--project-dir <path>] [--dry-run] [--force] [--json]\n\n` +
      `  ${c.bold}TOOLS${c.reset}\n` +
      `    ${ALL_TOOLS.join(", ")}${c.dim}  (default: all but claude-plugin)${c.reset}\n\n` +
      `  ${c.bold}NOTES${c.reset}\n` +
      `    ${c.dim}Existing files are never overwritten without --force.${c.reset}\n` +
      `    ${c.dim}--dry-run lists what would be written and touches nothing.${c.reset}\n\n`
  );
}

export function parseArgs(argv) {
  const opts: AgentsInitOptions = {
    tools: DEFAULT_TOOLS,
    projectDir: ".",
    dryRun: false,
    force: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tool" && argv[i + 1]) {
      opts.tools = argv[++i]
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    } else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("-")) opts.unknown = a;
  }
  return opts;
}

export function main(argv) {
  const opts = parseArgs(argv);
  const io = agentIo(opts.json || wantsJson(argv));
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

  const written = [];
  const skipped = [];
  const diagnostics = [];

  // Several tools share a destination — Claude and Codex both read AGENTS.md —
  // so a file is written once and attributed to the tools that asked for it.
  const planned = new Map();
  for (const tool of opts.tools) {
    for (const file of TOOLS[tool].files()) {
      const entry = planned.get(file.path);
      if (entry) entry.tools.push(tool);
      else planned.set(file.path, { ...file, tools: [tool] });
    }
  }

  {
    for (const file of planned.values()) {
      const tool = file.tools.join("+");
      const target = path.join(projectDir, file.path);
      const exists = fs.existsSync(target);

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
      }
      written.push({ tool, path: file.path });
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
      },
      status: diagnostics,
    },
    () => {
      const verb = opts.dryRun ? "would write" : "wrote";
      process.stdout.write(
        `\n  ${c.bold}agents init${c.reset} ${c.dim}(${opts.tools.join(", ")})${c.reset}\n\n`
      );
      for (const w of written) {
        process.stdout.write(`    ${c.green}+${c.reset} ${w.path} ${c.dim}${verb}${c.reset}\n`);
      }
      for (const s of skipped) {
        process.stdout.write(`    ${c.dim}· ${s.path} — exists, skipped${c.reset}\n`);
      }
      if (skipped.length > 0) {
        process.stdout.write(
          `\n  ${c.dim}Pass --force to overwrite the skipped files.${c.reset}\n`
        );
      }
      process.stdout.write(
        `\n  ${c.dim}Next: open your agent and run ${c.reset}/${AGENT_NAMESPACE}:explore${c.dim} (or read AGENTS.md).${c.reset}\n\n`
      );
    }
  );
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
