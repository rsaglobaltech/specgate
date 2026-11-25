/**
 * person-approves REQ-749: the exam proves which Specgate the agent reaches.
 *
 * A login shell runs the Developer's startup files, and on macOS
 * `path_helper` puts the system folders first again: a `specgate` installed
 * for every project then answers ahead of the exam's. The gate hook starts the
 * CLI through `npx --no-install`, which looks in npm's global prefix before the
 * PATH. So the exam's `specgate` is put first by every road it knows, marks
 * each time it runs, and the run starts only once both roads have reached it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export const CLI_CODE = "compat_cli_not_under_exam";

/** What the exam's `specgate` does at a level: run the CLI under exam, or answer that there is none. */
export type ExamCliKind = { run: string; cli: string } | { absent: string };

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * The exam's `specgate` in `bin`, and the same in an npm prefix of the run's,
 * marking `mark` each time it runs. Returns what the agent's environment needs
 * on top of `PATH` for both to come first: the prefix for `npx`, and startup
 * files for zsh that read the Developer's own and then put `bin` first again.
 */
export function examCli(
  scratch: string,
  bin: string,
  mark: string,
  kind: ExamCliKind,
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const body =
    "run" in kind
      ? `exec ${sh(kind.run)} ${sh(kind.cli)} "$@"`
      : `echo ${sh(kind.absent)} >&2\nexit 127`;
  const script = `#!/bin/sh\n: > ${sh(mark)}\n${body}\n`;
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "specgate"), script, { mode: 0o755 });
  const prefix = path.join(scratch, "npm-prefix");
  fs.mkdirSync(path.join(prefix, "bin"), { recursive: true });
  fs.writeFileSync(path.join(prefix, "bin", "specgate"), script, { mode: 0o755 });

  // zsh reads its startup files from ZDOTDIR: these read the Developer's, where they are, and then put bin first.
  const own = env.ZDOTDIR || env.HOME || "";
  const zdot = path.join(scratch, "zdot");
  fs.mkdirSync(zdot, { recursive: true });
  const first = `export PATH=${sh(bin)}:"$PATH"\n`;
  for (const [file, again] of [[".zshenv", false], [".zprofile", true], [".zshrc", true], [".zlogin", true]] as const) {
    const theirs = path.join(own, file);
    fs.writeFileSync(path.join(zdot, file), `[ -f ${sh(theirs)} ] && . ${sh(theirs)}\n${again ? first : ""}`);
  }
  return { NPM_CONFIG_PREFIX: prefix, ZDOTDIR: zdot };
}

export interface Reach {
  ok: boolean;
  /** Each road that did not reach the exam's `specgate`, and what it found. */
  missed: string[];
}

/**
 * Both roads an agent takes to `specgate`, run as the agent would: its login
 * shell, and `npx --no-install` as the hooks do. Each must leave the mark.
 */
export function cliReach(
  dir: string,
  env: Record<string, string | undefined>,
  mark: string,
  shell: string = env.SHELL || process.env.SHELL || "/bin/sh"
): Reach {
  const missed: string[] = [];
  const full = { ...process.env, ...env } as NodeJS.ProcessEnv;
  const roads: [string, string, string[]][] = [
    ["the login shell", shell, ["-lc", "specgate --version"]],
    ["npx", "npx", ["--no-install", "specgate", "--version"]],
  ];
  for (const [name, cmd, args] of roads) {
    fs.rmSync(mark, { force: true });
    spawnSync(cmd, args, { cwd: dir, env: full, encoding: "utf8", timeout: 60_000 });
    if (fs.existsSync(mark)) continue;
    const where = spawnSync(shell, ["-lc", "command -v specgate || true"], { cwd: dir, env: full, encoding: "utf8", timeout: 30_000 });
    const found = (where.stdout || "").trim();
    missed.push(name === "npx" ? `npx reached another specgate (the login shell finds ${found || "none"})` : `the login shell reached ${found || "no specgate"}`);
  }
  fs.rmSync(mark, { force: true });
  return { ok: missed.length === 0, missed };
}
