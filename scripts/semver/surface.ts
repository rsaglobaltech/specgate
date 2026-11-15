/**
 * The public surface Specgate promises not to break within a major version
 * (REQ-568), as a sorted list of items a diff can compare:
 *
 *   command:<name>            every command and sub-command
 *   flag:<command> <--flag>    every flag its `--help` lists
 *   code:<code>               every diagnostic code
 *   exit:<NAME> <code>        every exit code
 *   mcp:<tool>                every MCP tool
 *   api:<name>[.<member>]     the library API's exports and their members
 *   config:harness <key>      every key harness.config.yaml accepts
 *   config:setting <key>      every key `config set` accepts
 *   json:<command> <path>[:<type>]   every key the JSON answers of the
 *                             commands a tool reads carry, with its type
 *
 * An item that disappears, or a JSON key whose type changes, breaks a user;
 * an item that appears does not. `contract-check.ts` holds the diff to that.
 * Generated from the code and the CLI itself, never written by hand.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { SURFACE, mcpTools } from "../lib/surface";
import { EXIT } from "../lib/agent";
import { KNOWN_KEYS } from "../../packages/core/src/infrastructure/HarnessConfigFile";
import { KEYS as SETTING_KEYS } from "../cli/commands/config/ConfigSetCommand";

const ROOT = path.resolve(__dirname, "..", "..", "..").replace(/[\\/]dist$/, "");
const CLI = path.join(ROOT, "bin", "specgate.js");

function cli(cwd: string, args: string[]): { status: number | null; stdout: string; out: string } {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status, stdout: r.stdout || "", out: `${r.stdout || ""}${r.stderr || ""}` };
}

/** Every command and sub-command, as typed. */
export function commandItems(): string[][] {
  const out: string[][] = [];
  for (const c of SURFACE as ReadonlyArray<{
    name: string;
    subcommands?: Array<{ name: string }>;
  }>) {
    out.push([c.name]);
    for (const s of c.subcommands || []) out.push([c.name, s.name]);
  }
  return out;
}

/** The flags a command's `--help` lists. */
export function flagsOf(help: string): string[] {
  const flags = new Set<string>();
  for (const m of help.matchAll(/(?:^|[\s[(|,`])(--[a-z][a-z0-9-]*)/g)) flags.add(m[1]);
  flags.delete("--help");
  return [...flags];
}

/** `api:<name>` for each export of types/api.d.ts and `api:<Interface>.<member>` for each member. */
export function apiItems(dts: string): string[] {
  const items: string[] = [];
  for (const m of dts.matchAll(
    /^export (?:declare )?(?:const|function|class|type|interface) ([A-Za-z_$][\w$]*)/gm
  )) {
    items.push(`api:${m[1]}`);
  }
  for (const m of dts.matchAll(
    /^export (?:declare )?interface ([A-Za-z_$][\w$]*)[^{]*\{([\s\S]*?)^\}/gm
  )) {
    for (const member of m[2].matchAll(/^ {2}(?:readonly )?([A-Za-z_$][\w$]*)\??\s*[:(]/gm)) {
      items.push(`api:${m[1]}.${member[1]}`);
    }
  }
  return items;
}

/** `path` and `path:type` for every key of a JSON value; arrays merge their elements under `[]`. */
export function jsonPaths(value: unknown, prefix = ""): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, at: string) => {
    if (Array.isArray(v)) {
      if (at) out.add(`${at}:array`);
      for (const e of v) walk(e, `${at}[]`);
      return;
    }
    if (v !== null && typeof v === "object") {
      if (at) out.add(`${at}:object`);
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        walk(x, at ? `${at}.${k}` : k);
      }
      return;
    }
    if (!at) return;
    // A null says nothing about the type the key holds when it has a value.
    out.add(v === null ? at : `${at}:${typeof v}`);
  };
  walk(value, prefix);
  return [...out];
}

/**
 * The commands a tool reads as JSON — the ones specgate-studio drives
 * (docs/specs/agent-contract.md, "Shapes a tool depends on") — run on a fixed
 * project: one scaffolded, with one change proposed.
 */
export const JSON_COMMANDS: string[][] = [
  ["status"],
  ["change", "list"],
  ["change", "show", "pdf-invoices"],
  ["questions"],
  ["matrix", "--dry-run"],
  ["report"],
  ["config", "keys"],
  ["config", "list"],
  ["plan"],
  ["harness", "report"],
];

function jsonItems(): string[] {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-surface-"));
  try {
    const init = cli(parent, ["init", "--yes", "--out", parent, "--no-git"]);
    if (init.status !== 0) throw new Error(`init failed: ${init.out}`);
    const dir = path.join(parent, fs.readdirSync(parent)[0]);
    const propose = cli(dir, ["propose", "pdf-invoices"]);
    if (propose.status !== 0) throw new Error(`propose failed: ${propose.out}`);
    const items: string[] = [];
    for (const args of JSON_COMMANDS) {
      const r = cli(dir, [...args, "--json"]);
      let doc: unknown;
      try {
        doc = JSON.parse(r.stdout);
      } catch {
        throw new Error(
          `specgate ${args.join(" ")} --json did not answer JSON: ${r.out.slice(0, 300)}`
        );
      }
      const name = args.filter((a) => !a.startsWith("-") && a !== "pdf-invoices").join(" ");
      for (const p of jsonPaths(doc)) items.push(`json:${name} ${p}`);
    }
    return items;
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

/**
 * Every diagnostic code the source emits — `error("code"`, `warning(`,
 * `info(`, `fail(`, `diagnostic(…, "code"` — across scripts/ and the core, tests
 * left out. The agent contract's list covers the commands it documents; the
 * promise covers every code a tool may branch on.
 */
export function diagnosticCodes(): string[] {
  const codes = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "test" && e.name !== "tests" && e.name !== "node_modules") walk(p);
      } else if (
        e.name.endsWith(".ts") &&
        !e.name.endsWith(".test.ts") &&
        !e.name.endsWith(".d.ts")
      ) {
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/\b(?:error|warning|info|fail)\(\s*"([a-z][a-z0-9_]*)"/g))
          codes.add(m[1]);
        for (const m of src.matchAll(/\bdiagnostic\(\s*[^,()]+,\s*"([a-z][a-z0-9_]*)"/g))
          codes.add(m[1]);
      }
    }
  };
  walk(path.join(ROOT, "scripts"));
  walk(path.join(ROOT, "packages", "core", "src"));
  return [...codes].sort();
}

/** The whole public surface, sorted and without duplicates. */
export function snapshotSurface(): string[] {
  const items = new Set<string>();
  for (const cmd of commandItems()) {
    const name = cmd.join(" ");
    items.add(`command:${name}`);
    for (const flag of flagsOf(cli(ROOT, [...cmd, "--help"]).out))
      items.add(`flag:${name} ${flag}`);
  }
  for (const code of diagnosticCodes()) items.add(`code:${code}`);
  for (const [name, code] of Object.entries(EXIT)) items.add(`exit:${name} ${code}`);
  for (const tool of Object.keys(mcpTools())) items.add(`mcp:${tool}`);
  for (const item of apiItems(fs.readFileSync(path.join(ROOT, "types", "api.d.ts"), "utf8"))) {
    items.add(item);
  }
  for (const key of KNOWN_KEYS) items.add(`config:harness ${key}`);
  for (const key of Object.keys(SETTING_KEYS)) items.add(`config:setting ${key}`);
  for (const item of jsonItems()) items.add(item);
  return [...items].sort();
}
