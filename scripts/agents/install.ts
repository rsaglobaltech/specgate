#!/usr/bin/env node
/**
 * `specgate agents install --global` (REQ-423): the agent guards once per
 * user, for every project — and quiet in the ones without `spec.md`.
 *
 * OpenCode loads every `plugin/*.js` of its global config folder, so the
 * plugin is written there. Claude Code installs plugins itself, from a
 * marketplace: this repository is one (`.claude-plugin/marketplace.json`),
 * and the command prints the two lines that install it.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { error } from "../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { c } from "../lib/ui";
import * as ui from "../lib/ui";
import { opencodePluginFiles } from "./init";

/** The tools `install --global` knows. */
const GLOBAL_TOOLS = ["claude-plugin", "opencode-plugin"];

/** Where Claude Code finds this repository's plugin. */
export const CLAUDE_INSTALL = [
  "/plugin marketplace add rsaglobaltech/specgate",
  "/plugin install specgate@specgate",
];

/** OpenCode's global config folder: `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode` — on Windows too. */
export function opencodeGlobalDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || env.USERPROFILE || os.homedir(), ".config");
  return path.join(base, "opencode");
}

interface InstallOptions {
  global: boolean;
  tools: string[];
  json: boolean;
  help?: boolean;
  unknown?: string;
}

export function parseArgs(argv: string[]): InstallOptions {
  const opts: InstallOptions = { global: false, tools: GLOBAL_TOOLS, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--global") opts.global = true;
    else if (a === "--tool" && argv[i + 1]) {
      opts.tools = argv[++i]
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    } else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("-")) opts.unknown = a;
  }
  return opts;
}

function usage(): void {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}🛡  agents install${c.reset}  ${c.dim}— the agent guards, once for every project${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    specgate agents install --global [--tool claude-plugin|opencode-plugin] [--json]\n\n` +
      `  ${c.bold}NOTES${c.reset}\n` +
      `    ${c.dim}OpenCode: the plugin goes into ${opencodeGlobalDir()}.${c.reset}\n` +
      `    ${c.dim}Claude Code: run the two /plugin commands it prints.${c.reset}\n` +
      `    ${c.dim}Projects without spec.md see nothing from either.${c.reset}\n\n`
  );
}

/** Write the OpenCode plugin under `dir`, each file with what happened to it. */
export function installOpencode(dir: string): { path: string; action: "create" | "update" | "unchanged" }[] {
  return opencodePluginFiles(".").map((f) => {
    const target = path.join(dir, f.path);
    const before = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    const action = before === null ? "create" : before === f.contents ? "unchanged" : "update";
    if (action !== "unchanged") {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.contents, "utf8");
    }
    return { path: target, action };
  });
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  const io = agentIo(opts.json || wantsJson(argv));
  const NULL_SHAPE = { files: null };
  if (opts.help) {
    usage();
    process.exit(EXIT.OK);
  }
  if (opts.unknown) {
    io.usage(NULL_SHAPE, [
      error("unknown_flag", `Unknown flag: ${opts.unknown}`, {
        target: opts.unknown,
        fix: "Run `specgate agents install --help` for the accepted flags.",
      }),
    ]);
  }
  if (!opts.global) {
    io.usage(NULL_SHAPE, [
      error("install_needs_global", "`agents install` installs for every project of this user: pass --global.", {
        fix: "specgate agents install --global — or, for this project only, `specgate agents init --tool opencode-plugin` / `--tool claude-plugin`.",
      }),
    ]);
  }
  const unknown = opts.tools.filter((t) => !GLOBAL_TOOLS.includes(t));
  if (unknown.length) {
    io.usage(NULL_SHAPE, [
      error("tool_unknown", `Not installable globally: ${unknown.join(", ")}`, {
        target: unknown.join(","),
        fix: `Supported: ${GLOBAL_TOOLS.join(", ")}.`,
      }),
    ]);
  }

  const files = opts.tools.includes("opencode-plugin") ? installOpencode(opencodeGlobalDir()) : [];
  const claude = opts.tools.includes("claude-plugin") ? CLAUDE_INSTALL : [];
  io.emit({ files, claude: { commands: claude }, status: [] }, () => {
    process.stdout.write(ui.header("agents install", opts.tools.join(", ")));
    if (files.length) {
      process.stdout.write(`  ${c.bold}OpenCode${c.reset}  ${ui.muted(opencodeGlobalDir())}\n`);
      for (const f of files) {
        process.stdout.write(`    ${f.action === "unchanged" ? ui.muted(`= ${f.path}`) : `+ ${f.path}`}\n`);
      }
      process.stdout.write("\n");
    }
    if (claude.length) {
      process.stdout.write(`  ${c.bold}Claude Code${c.reset}  ${ui.muted("in a session, run:")}\n`);
      for (const line of claude) process.stdout.write(`    ${c.cyan}${line}${c.reset}\n`);
      process.stdout.write("\n");
    }
    process.stdout.write(
      `  ${ui.muted("Projects without spec.md see nothing from them. Off for one project: specgate config set agent_guard off")}\n\n`
    );
  });
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
