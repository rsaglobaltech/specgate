import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * forja, the project generator Specgate calls (ADR-0033).
 *
 * Specgate is the one command a user learns; forja stays its own package, so
 * Specgate keeps zero runtime dependencies: it is fetched with `npx` only when
 * someone asks for a generated project. The major version is pinned here and
 * moved in Specgate's own releases.
 */
export const FORJA_PACKAGE = "@rsaglobaltech/forja";
export const FORJA_VERSION = "1";

/** Whether a `forja` command is on the PATH: installed globally or linked. */
export function forjaOnPath(): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  const found = spawnSync(finder, ["forja"], { stdio: "ignore" });
  return !found.error && found.status === 0;
}

/**
 * The command line that runs forja (REQ-236): `SPECGATE_FORJA_CMD` — a forja
 * of your own, or a fake one in tests — then a `forja` on the PATH, then npx
 * at the pinned major.
 */
export function forjaCommand(
  env: NodeJS.ProcessEnv = process.env,
  onPath: boolean = forjaOnPath()
): string {
  const override = (env.SPECGATE_FORJA_CMD || "").trim();
  if (override) return override;
  return onPath ? "forja" : `npx --yes ${FORJA_PACKAGE}@${FORJA_VERSION}`;
}

/**
 * Before npx runs: whether npm has the package at all. npm's own 404 says
 * nothing about installing forja or about SPECGATE_FORJA_CMD; null when it
 * can be fetched, else what npm said.
 */
export function forjaUnavailable(command: string): string | null {
  if (!command.startsWith("npx ")) return null;
  const view = spawnSync("npm", ["view", `${FORJA_PACKAGE}@${FORJA_VERSION}`, "version"], {
    shell: true,
    encoding: "utf8",
    timeout: 30000,
  });
  if (!view.error && view.status === 0 && (view.stdout || "").trim()) return null;
  return (`${view.stderr || ""}${view.stdout || ""}`.trim().split("\n")[0] || "no answer").trim();
}

/** Quotes one argument for the shell the command runs in. */
function quote(arg: string): string {
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(arg)) return arg;
  return process.platform === "win32"
    ? `"${arg.replace(/"/g, '\\"')}"`
    : `'${arg.replace(/'/g, "'\\''")}'`;
}

/** This Specgate's version, from its own package.json; "" when it cannot be read. */
export function ownVersion(): string {
  let dir = __dirname;
  for (;;) {
    const file = path.join(dir, "package.json");
    if (fs.existsSync(file)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
        if (pkg.name === "@rsaglobaltech/specgate") return String(pkg.version || "");
      } catch {
        /* not ours: keep going up */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return "";
    dir = parent;
  }
}

/** forja's environment: ours, plus the Specgate it should depend on (REQ-236). */
function forjaEnv(): NodeJS.ProcessEnv {
  const version = ownVersion();
  return version ? { ...process.env, SPECGATE_VERSION: version } : process.env;
}

/** Runs forja with its own terminal: it has prompts and a spinner of its own. */
export function runForja(args: string[], cwd: string): number {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, { cwd, shell: true, stdio: "inherit", env: forjaEnv() });
  if (run.error) return 127;
  return run.status ?? 1;
}

/** The same, capturing what forja printed: for `--json`, where stdout is one document. */
export function runForjaCaptured(args: string[], cwd: string): { status: number; output: string } {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, {
    cwd,
    shell: true,
    env: forjaEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: run.error ? 127 : (run.status ?? 1),
    output: `${run.stdout || ""}${run.stderr || ""}`.trim(),
  };
}

/** The nearest directory, from `from` up, holding a forja.config.json. */
export function findForjaProject(from: string): string | null {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, "forja.config.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
