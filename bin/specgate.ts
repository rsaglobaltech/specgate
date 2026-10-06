#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

const rootDir = path.resolve(__dirname, "..", "..");
const distScripts = path.join(__dirname, "..", "scripts");
const packageJson = require(path.join(rootDir, "package.json"));
const VERSION: string = packageJson.version || "0.0.0";
import { ICommand } from "../scripts/lib/command";
import { SURFACE, helpRows, coreHelpRows, hiddenCommandCount } from "../scripts/lib/surface";

/** Resolve a registry row's `script` segments to a path under dist/scripts. */
function resolveScript(segments: string[]): string {
  return path.join(distScripts, ...segments);
}

// ── Pretty output helpers ─────────────────────────────────────────────────────────

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";

const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  blue: COLOR_ENABLED ? "\x1b[34m" : "",
  magenta: COLOR_ENABLED ? "\x1b[35m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
};

function info(msg: string): void {
  process.stdout.write(`${c.cyan}ℹ${c.reset}  ${msg}\n`);
}

function error(msg: string): void {
  process.stderr.write(`${c.red}✖${c.reset}  ${msg}\n`);
}

function banner(): string {
  return (
    `\n` +
    `  ${c.bold}${c.cyan}🧭 specgate${c.reset}  ${c.dim}v${VERSION}${c.reset}\n` +
    `  ${c.dim}Specs as executable contracts — requirements, scenarios and traceability that CI enforces.${c.reset}\n`
  );
}

function section(title: string): string {
  return `\n  ${c.bold}${title}${c.reset}\n`;
}

function cmd(emoji: string, name: string, summary: string, pad = 16): string {
  // Use Array.from to count code points (emojis with surrogate pairs count as 1)
  const visible = Array.from(name).length;
  const padding = " ".repeat(Math.max(1, pad - visible));
  return `    ${c.green}${emoji}${c.reset}  ${c.green}${name}${c.reset}${padding}${c.dim}${summary}${c.reset}\n`;
}

function flag(name: string, summary: string, pad = 18): string {
  const visible = Array.from(name).length;
  const padding = " ".repeat(Math.max(1, pad - visible));
  return `    ${c.green}${name}${c.reset}${padding}${c.dim}${summary}${c.reset}\n`;
}

function example(line: string, comment?: string): string {
  const prefix = comment ? `    ${c.dim}# ${comment}${c.reset}\n` : "";
  return `${prefix}    ${c.yellow}$${c.reset} ${line}\n`;
}

/**
 * The worked examples of `--help --all`. Prose, not surface: they are chosen
 * for what they teach, so they are declared here rather than derived.
 */
const EXAMPLES =
  example(`npx @rsaglobaltech/specgate@latest init`, "Generate a new project (wizard)") +
  example(
    `npx @rsaglobaltech/specgate@latest adopt --project-dir ./my-existing-repo`,
    "Adopt SDD on an existing codebase"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest init --config ./project.config --out ./projects`,
    "Generate a new project from a config file"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest validate ./projects/my-app --strict`,
    "Validate with the gate"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest expand --pack-root ./domain-packs \\\n        --pack parking-management/backend --project-dir ./projects/my-app \\\n        --var PROJECT_NAME="My App" --var PROJECT_SLUG=my-app --var DOMAIN="parking ops"`,
    "Apply a local pack"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest expand --pack-repo https://github.com/acme/parking-specops.git \\\n        --pack-version v0.1.0 --pack backend --project-dir ./projects/smart-parking \\\n        --var PROJECT_NAME="Smart Parking"`,
    "Apply a remote pack pinned to a git tag"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest specops sync --project-dir ./projects/smart-parking`,
    "Re-expand everything in .specops.lock / specops.config.yaml"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest specops diff --project-dir ./projects/smart-parking --pack-version v0.2.0`,
    "Preview a version bump"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest plan --project-dir ./projects/smart-parking`,
    "Show what requirements still need work"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest plan --project-dir ./projects/smart-parking --format json`,
    "Same, machine-readable for AI agents"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest done REQ-007 --check`,
    "Mark REQ-007 Implemented (after validate passes)"
  ) +
  example(
    `npx @rsaglobaltech/specgate@latest pack init --out ./domain-packs --name "Billing Backend" --type contracts`,
    "Scaffold a contracts-flavoured pack"
  );

/**
 * The daily loop, narrowed.
 *
 * The surface grew past twenty, which is more than anyone reads. A new user
 * needs `init` or `adopt` once, then lives in status → plan → req → change →
 * validate → done. Everything else is real but not first — `--help --all`
 * shows it, and `specgate config set profile full` makes that the default.
 *
 * Both help profiles are rendered from the surface registry, so a command
 * cannot exist without appearing in one of them or being deliberately absent
 * from both.
 */
function renderGroups(groups: any[]): string {
  return groups
    .map((g) => section(g.title) + g.rows.map((r: any) => cmd(r.icon, r.label, r.summary)).join(""))
    .join("");
}

function usageCore() {
  process.stdout.write(
    banner() +
      section("USAGE") +
      `    ${c.cyan}specgate${c.reset} ${c.bold}<command>${c.reset} [options]\n` +
      `    ${c.dim}Run ‘<command> --help’ for per-command details.${c.reset}\n` +
      renderGroups(coreHelpRows()) +
      section("MORE") +
      `    ${c.dim}${hiddenCommandCount()} more commands cover packs, automation, agents and reporting.${c.reset}\n` +
      `    ${c.green}specgate --help --all${c.reset}${c.dim}                    show every command${c.reset}\n` +
      `    ${c.green}specgate config set profile full${c.reset}${c.dim}         make that the default${c.reset}\n` +
      section("EXAMPLES") +
      example(`npx @rsaglobaltech/specgate@latest adopt`, "Existing codebase") +
      example(`npx @rsaglobaltech/specgate@latest init`, "New project (wizard)") +
      example(`specgate status`, "Start of day") +
      "\n"
  );
}

/**
 * `core` unless the project says otherwise. Read from .csda/config.json so a
 * team that lives in the full surface is not re-narrowed on every invocation.
 */
function helpProfile(): string {
  if (process.env.CSDA_PROFILE) return process.env.CSDA_PROFILE;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".csda", "config.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.profile === "string") return parsed.profile;
  } catch {
    // No config, unreadable, or malformed — core is the safe default.
  }
  return "core";
}

function usage(opts?: { all?: boolean }) {
  if (opts && opts.all) return usageFull();
  if (helpProfile() === "full") return usageFull();
  return usageCore();
}

function usageFull() {
  process.stdout.write(
    banner() +
      section("USAGE") +
      `    ${c.cyan}specgate${c.reset} ${c.bold}<command>${c.reset} [options]\n` +
      `    ${c.dim}Run ‘<command> --help’ for per-command details.${c.reset}\n` +
      renderGroups(helpRows()) +
      section("GLOBAL FLAGS") +
      flag("-h, --help", "Show this help.") +
      flag("-v, --version", "Show CLI version.") +
      section("EXAMPLES") +
      EXAMPLES +
      section("LEARN MORE") +
      `    ${c.dim}📖 How-to guide   ${c.reset}${c.blue}https://github.com/rsaglobaltech/specgate/blob/main/docs/how-to.md${c.reset}\n` +
      `    ${c.dim}🌐 Documentation  ${c.reset}${c.blue}https://rsaglobaltech.github.io/specgate/${c.reset}\n` +
      `    ${c.dim}🪲 Report a bug   ${c.reset}${c.blue}https://github.com/rsaglobaltech/specgate/issues${c.reset}\n` +
      `\n`
  );
}

function ensureExecutable(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    error(`Required script not found: ${scriptPath}`);
    process.exit(3);
  }
}

function runNodeScript(scriptPath: string, args: string[]): void {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    error(`Failed to execute script: ${result.error.message}`);
    process.exit(1);
  }

  if (result.signal) {
    error(`Process terminated by signal: ${result.signal}`);
    process.exit(1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

export class CreateSpecDrivenAppCommand implements ICommand {
  public execute(args: string[] = []): void {
    args = args.length ? args : process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      usage({ all: args.includes("--all") });
      process.exit(0);
    }

    if (args[0] === "--version" || args[0] === "-v") {
      process.stdout.write(`${VERSION}\n`);
      process.exit(0);
    }

    const command = args[0];

    const row = SURFACE.find((c: any) => c.name === command);
    if (!row) {
      info(`Unknown command: ${command}`);
      usage();
      process.exit(2);
    }

    // Three commands need more than a table row. Each is a genuine parsing
    // decision, not a route, which is why it lives here and not in the registry.
    if (command === "init") return dispatchInit(args.slice(1));
    if (command === "validate") return dispatchValidate(args.slice(1));
    if (command === "harness" && args[1] === "prompt") return dispatchHarnessPrompt(args);

    // A command with its own script owns its sub-commands: the dispatcher hands
    // the whole tail over and the script reports an unknown one in its own words.
    if (row.script) {
      const target = resolveScript(row.script);
      ensureExecutable(target);
      runNodeScript(target, args.slice(1));
      return;
    }

    // Otherwise the sub-command is the route, and an unknown one stops here.
    const subName = args[1];
    const sub = (row.subcommands || []).find((s: any) => s.name === subName);
    if (!sub) {
      const expected = (row.subcommands || []).map((s: any) => s.name).join(", ");
      error(`Unknown ${command} sub-command: ${subName || "(none)"}. Expected: ${expected}`);
      usage();
      process.exit(2);
    }

    const target = resolveScript(sub.script);
    ensureExecutable(target);
    runNodeScript(target, args.slice(sub.argsFrom === undefined ? 2 : sub.argsFrom));
  }
}

/**
 * `init` is two commands wearing one name: `--from-pack` composes it with
 * `specops add`, which needs its own orchestrator rather than another flag
 * inside init.
 */
function dispatchInit(passThrough: string[]): void {
  // Reject --engine=shell — the Bash engine was removed in this release.
  const engineIdx = passThrough.indexOf("--engine");
  if (
    passThrough.includes("--engine=shell") ||
    (engineIdx !== -1 && passThrough[engineIdx + 1] === "shell")
  ) {
    error(
      "--engine=shell was removed. The CLI is now Node-only. Drop the flag to use the (sole) Node engine."
    );
    process.exit(2);
  }
  const script = passThrough.includes("--from-pack")
    ? resolveScript(["init_from_pack.js"])
    : resolveScript(["init_project.js"]);
  ensureExecutable(script);
  runNodeScript(script, passThrough);
}

/**
 * `validate` is the gate, so a typo in a flag must not read as "nothing to
 * report". It is the one command whose arguments the dispatcher checks.
 */
function dispatchValidate(validateArgs: string[]): void {
  const script = resolveScript(["validate_specs.js"]);
  ensureExecutable(script);

  // `--help` before the positional check. Asking a command what it does must
  // never be a usage error — `specgate validate --help` answered "expects
  // exactly one positional argument", which is the tool refusing to explain
  // itself to someone who is trying to learn it.
  if (validateArgs.includes("--help") || validateArgs.includes("-h")) {
    runNodeScript(script, ["--help"]);
    return;
  }

  // `--delivering` takes a value; it is not a second project directory.
  const deliveringAt = validateArgs.indexOf("--delivering");
  const positional = validateArgs.filter(
    (a, i) => !a.startsWith("-") && !(deliveringAt >= 0 && i === deliveringAt + 1)
  );
  if (positional.length !== 1) {
    error(`'validate' expects exactly one positional argument: <project_dir>`);
    usage();
    process.exit(2);
  }
  const VALIDATE_FLAGS = new Set([
    "--strict",
    "--strict-tdd",
    "--strict-scenarios",
    "--strict-requirements",
    "--strict-links",
    "--strict-coverage",
    "--against-lock",
    "--json",
    // Internal: `done --check` and the harness hold the requirement they are
    // delivering to what a delivered row owes. Not in the help on purpose.
    "--delivering",
  ]);
  const unknownFlags = validateArgs.filter((a) => a.startsWith("-") && !VALIDATE_FLAGS.has(a));
  if (unknownFlags.length > 0) {
    error(`Unknown flag(s) for validate: ${unknownFlags.join(", ")}`);
    usage();
    process.exit(2);
  }

  runNodeScript(script, validateArgs);
}

/**
 * `harness prompt <REQ-id>` is a friendly alias for `harness run --dry-run
 * --req <REQ>`: it prints the prompt the agent would receive, with no git, no
 * agent and no gate.
 */
function dispatchHarnessPrompt(args: string[]): void {
  const reqId = args[2];
  if (!reqId || !/^REQ-\d+$/.test(reqId)) {
    error("`harness prompt` expects a REQ-id, e.g. `specgate harness prompt REQ-001`.");
    usage();
    process.exit(2);
  }
  const script = resolveScript(["harness", "run.js"]);
  ensureExecutable(script);
  runNodeScript(script, ["--dry-run", "--req", reqId, ...args.slice(3)]);
}

/**
 * Run when this module *is* the entry point, or when the published `bin/` shim
 * required it.
 *
 * The shim is two lines — `require("../dist/bin/specgate.js")` — so
 * `require.main` is the shim and not this module, and the check has to
 * recognise it by name.
 *
 * Compare on the basename. An earlier form asked
 * `filename.endsWith("bin/specgate.js")`, and on Windows
 * `filename` is `bin\specgate.js`, so it never matched: the CLI
 * loaded, dispatched nothing, and exited 0 with no output on either stream.
 * Every test that spawns the CLI failed — 437 of them — and none of the
 * messages said why, because there was no message.
 *
 * It survived because this branch had never been through CI, and the two
 * platforms it was developed on both use `/`.
 */
const isEntryPoint =
  require.main === module ||
  (require.main
    ? ["specgate.js", "specgate.js"].includes(path.basename(require.main.filename))
    : false);

if (isEntryPoint) {
  new CreateSpecDrivenAppCommand().execute();
}
