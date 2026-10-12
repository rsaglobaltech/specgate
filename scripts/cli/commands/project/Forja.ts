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

/**
 * The command line that runs forja. `SPECGATE_FORJA_CMD` replaces it — a forja
 * installed or linked locally (`forja`), or a fake one in tests.
 */
export function forjaCommand(env: NodeJS.ProcessEnv = process.env): string {
  const override = (env.SPECGATE_FORJA_CMD || "").trim();
  return override || `npx --yes ${FORJA_PACKAGE}@${FORJA_VERSION}`;
}

/** Quotes one argument for the shell the command runs in. */
function quote(arg: string): string {
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(arg)) return arg;
  return process.platform === "win32"
    ? `"${arg.replace(/"/g, '\\"')}"`
    : `'${arg.replace(/'/g, "'\\''")}'`;
}

/** Runs forja with its own terminal: it has prompts and a spinner of its own. */
export function runForja(args: string[], cwd: string): number {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, { cwd, shell: true, stdio: "inherit" });
  if (run.error) return 127;
  return run.status ?? 1;
}

/** The same, capturing what forja printed: for `--json`, where stdout is one document. */
export function runForjaCaptured(args: string[], cwd: string): { status: number; output: string } {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, {
    cwd,
    shell: true,
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
