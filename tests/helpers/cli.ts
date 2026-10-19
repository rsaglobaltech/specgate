/**
 * Shared, typed helpers for tests that drive the built `specgate` CLI as a
 * child process. They mirror the per-file `cli(...)` helpers the suites grew
 * independently, so a test that switches to them runs the exact same command.
 */
import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding, SpawnSyncReturns } from "node:child_process";
import * as path from "node:path";

/** Repository root, whether the tests run from `tests/` or the compiled `dist/tests/`. */
export const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);

/** The CLI entry point every suite spawns. */
export const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

/** What a CLI run returns: exit status plus captured UTF-8 stdout and stderr. */
export type CliResult = SpawnSyncReturns<string>;

/** Spawn options other than `encoding`, which is always UTF-8. */
export type CliOptions = Omit<SpawnSyncOptionsWithStringEncoding, "encoding">;

/** Runs `specgate <args>` with the given spawn options and captures its output as text. */
export function runCli(args: readonly string[], options: CliOptions = {}): CliResult {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8", ...options });
}

/** Runs `specgate <args>` from the current working directory. */
export function cli(...args: string[]): CliResult {
  return runCli(args);
}

/** Runs `specgate <args>` from the repository root. */
export function cliFromRoot(...args: string[]): CliResult {
  return runCli(args, { cwd: ROOT_DIR });
}

/**
 * Parses the JSON document a CLI run printed, skipping anything before its
 * first `{`. The result is whatever the command emitted, so it is untyped.
 */
export function json(r: CliResult) {
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}
