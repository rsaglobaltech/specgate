/**
 * Run an agent on one change, and undo whatever it writes anywhere else.
 *
 * `change author` does the same with a precondition: a clean working tree, so
 * that reverting can only ever discard the agent's own work. That is the
 * safe rule, and on the brief-first path it is the wrong one — the person
 * has just saved `docs/brief.md` and `specgate draft` has just created the
 * change, so the tree is never clean when they reach for `--agent`.
 *
 * So this one remembers instead of refusing. Before the agent runs, it reads
 * every file git already reports as changed or untracked; afterwards, any
 * path outside the change that differs is put back the way it was — a file
 * the person had edited returns to *their* edit, not to the last commit, and
 * a file the agent created is removed. Git is still required: it is how the
 * agent's footprint is found at all.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import { isInScope } from "../../packages/core/src/domain/AuthoringScope";

export interface ConfinedRun {
  ok: boolean;
  /** Why it did not run, or how the agent failed. */
  problem?: "no_git" | "agent_failed";
  detail?: string;
  wrote: string[];
  reverted: string[];
}

/** Every path git sees as changed or untracked, one file per entry. */
function dirtyPaths(projectDir: string): string[] | null {
  const r = spawnSync(
    "git",
    ["-C", projectDir, "status", "--porcelain", "--untracked-files=all", "-z"],
    { encoding: "utf8" }
  );
  if (r.status !== 0) return null;
  const out: string[] = [];
  const parts = String(r.stdout).split("\0").filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const code = parts[i].slice(0, 2);
    out.push(parts[i].slice(3));
    // A rename carries its old path as the next entry.
    if (code[0] === "R" || code[0] === "C") i += 1;
  }
  return out;
}

/**
 * The command, with the prompt delivered: a `{prompt_file}` placeholder is
 * replaced by a file holding it; otherwise the prompt goes to standard input,
 * which is what `claude -p`, `codex exec -` and most agent CLIs read.
 */
export function agentInvocation(
  command: string,
  promptFile: string
): { command: string; stdin: boolean } {
  return command.includes("{prompt_file}")
    ? { command: command.split("{prompt_file}").join(promptFile), stdin: false }
    : { command, stdin: true };
}

export function runConfinedAgent(o: {
  projectDir: string;
  /** Names the run (the prompt file); also the scope unless `allowed` is given. */
  changeId: string;
  /** The paths the agent may write. Default: the change's own folder. */
  allowed?: (relativePath: string) => boolean;
  command: string;
  prompt: string;
  /** Where the agent's own output goes: the terminal, or captured for --json. */
  showOutput: boolean;
}): ConfinedRun {
  const inScope = o.allowed || ((rel: string) => isInScope(rel, o.changeId));
  const before = dirtyPaths(o.projectDir);
  if (before === null) return { ok: false, problem: "no_git", wrote: [], reverted: [] };

  // What the person had, outside the change, before the agent touched anything.
  const saved = new Map<string, Buffer | null>();
  for (const rel of before) {
    if (inScope(rel)) continue;
    const full = path.join(o.projectDir, rel);
    saved.set(
      rel,
      fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full) : null
    );
  }

  const promptFile = path.join(os.tmpdir(), `specgate-draft-${o.changeId}-${Date.now()}.md`);
  fs.writeFileSync(promptFile, o.prompt, "utf8");
  let agent;
  try {
    const call = agentInvocation(o.command, promptFile);
    agent = spawnSync(call.command, {
      shell: true,
      cwd: o.projectDir,
      encoding: "utf8",
      input: call.stdin ? o.prompt : "",
      // Shown, the agent talks in the same stream as the command around it, so
      // its lines land in order. In --json mode it is captured: stdout is one
      // document and nothing else.
      stdio: ["pipe", o.showOutput ? 1 : "pipe", o.showOutput ? 2 : "pipe"],
    });
  } finally {
    fs.rmSync(promptFile, { force: true });
  }

  const after = dirtyPaths(o.projectDir) || [];
  const wrote: string[] = [];
  const reverted: string[] = [];
  for (const rel of after) {
    if (inScope(rel)) {
      if (!before.includes(rel)) wrote.push(rel);
      continue;
    }
    const full = path.join(o.projectDir, rel);
    if (saved.has(rel)) {
      const was = saved.get(rel);
      const now = fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full) : null;
      if (was === null && now === null) continue;
      if (was !== null && now !== null && was.equals(now)) continue;
      if (was === null) fs.rmSync(full, { recursive: true, force: true });
      else fs.writeFileSync(full, was);
      reverted.push(rel);
    } else {
      // Clean before, changed now: the agent did it.
      const tracked =
        spawnSync("git", ["-C", o.projectDir, "ls-files", "--error-unmatch", "--", rel], {
          encoding: "utf8",
        }).status === 0;
      if (tracked) spawnSync("git", ["-C", o.projectDir, "checkout", "--", rel]);
      else fs.rmSync(full, { recursive: true, force: true });
      reverted.push(rel);
    }
  }
  // A file the person had changed and the agent deleted is gone from `after`.
  for (const [rel, was] of saved) {
    if (was === null || after.includes(rel)) continue;
    const full = path.join(o.projectDir, rel);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, was);
      reverted.push(rel);
    }
  }

  if (agent.status !== 0) {
    const tail = `${agent.stdout || ""}${agent.stderr || ""}`.trim().slice(-500);
    return {
      ok: false,
      problem: "agent_failed",
      detail: `exited ${agent.status ?? "on a signal"}${tail ? `: ${tail}` : ""}`,
      wrote,
      reverted,
    };
  }
  return { ok: true, wrote, reverted };
}
