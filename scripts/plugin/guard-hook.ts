#!/usr/bin/env node

/**
 * The `PreToolUse` hook: an edit to source code waits for a test that names
 * the requirement (REQ-421).
 *
 * The loop says the test comes first, and `AGENTS.md` says so in words. Words
 * did not stop an agent on 2026-11-07 from writing the implementation right
 * after `specgate propose`. This does: while no change is open, or no test new
 * or modified in the working tree names one of its requirements, a write to a
 * source file is refused, with the step to take instead.
 *
 * Contract: stdin is JSON with `cwd`, `tool_name` and `tool_input`; exit 2
 * refuses the tool call and stderr is what the agent reads; exit 0 allows it.
 * Anything unexpected allows it — a guard that breaks a session over a
 * missing file is worse than none.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { changedFiles, guardOff, isSpecDriven, isTestFile, needsTest, openChanges } from "./project-state";

/** The tools that write a file, and where each names it. */
const WRITERS: Record<string, string> = {
  Write: "file_path",
  Edit: "file_path",
  MultiEdit: "file_path",
  NotebookEdit: "notebook_path",
};

export interface GuardInput {
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface GuardDecision {
  allow: boolean;
  message: string;
}

const ALLOW: GuardDecision = { allow: true, message: "" };

/** A path with its symlinks resolved as far as it exists (`/var` is `/private/var` on macOS). */
function real(p: string): string {
  let dir = path.resolve(p);
  const rest: string[] = [];
  while (!fs.existsSync(dir) && path.dirname(dir) !== dir) {
    rest.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
  return path.join(fs.realpathSync.native(dir), ...rest);
}

/** Does any of these files, read from `root`, name one of the ids? */
function namesAny(root: string, files: string[], ids: string[]): boolean {
  const pattern = new RegExp(`\\b(${ids.map((i) => i.replace(/-/g, "\\-")).join("|")})\\b`);
  return files.some((f) => {
    try {
      return pattern.test(fs.readFileSync(path.join(root, f), "utf8"));
    } catch {
      return false;
    }
  });
}

/** Allow or refuse one tool call. `env` is injected so tests do not depend on the shell. */
export function decide(input: GuardInput, env: Record<string, string | undefined>): GuardDecision {
  try {
    const key = WRITERS[input.tool_name ?? ""];
    const target = key ? input.tool_input?.[key] : undefined;
    if (typeof target !== "string" || !target) return ALLOW;
    const cwd = input.cwd ?? process.cwd();
    if (!isSpecDriven(cwd) || guardOff(cwd, env)) return ALLOW;

    const root = real(cwd);
    const rel = path.relative(root, real(path.isAbsolute(target) ? target : path.join(cwd, target)));
    if (rel.startsWith("..") || path.isAbsolute(rel) || !needsTest(rel)) return ALLOW;

    const changed = changedFiles(cwd);
    if (changed === null) return ALLOW;
    const changes = openChanges(cwd);
    if (!changes.length) {
      return {
        allow: false,
        message:
          `specgate: No change is open, so ${rel} has no requirement to answer to. ` +
          "Open one with `specgate propose <change-id>` and write its delta, then the test that names its first requirement, then this code. " +
          "(Turn the guard off for this project with `specgate config set agent_guard off`.)",
      };
    }
    const ids = changes.flatMap((c) => c.requirements);
    if (ids.length && namesAny(cwd, changed.filter(isTestFile), ids)) return ALLOW;

    const owner = changes.find((c) => c.pending.length) ?? changes[0];
    const next = owner.pending[0] ?? owner.requirements[0];
    return {
      allow: false,
      message: next
        ? `specgate: write the test for ${next} first — change \`${owner.id}\`. ` +
          `A test file new or changed in the working tree that names ${next} is the link; then ${rel} is allowed, then \`specgate apply ${next}\`.`
        : `specgate: change \`${owner.id}\` has no requirement yet. Write its delta first (\`specgate change instructions specs ${owner.id}\`), then the test, then ${rel}.`,
    };
  } catch {
    return ALLOW;
  }
}

export function main(raw: string, env: Record<string, string | undefined> = process.env): number {
  let input: GuardInput;
  try {
    input = JSON.parse(raw);
  } catch {
    return 0;
  }
  const decision = decide(input, env);
  if (decision.allow) return 0;
  process.stderr.write(`${decision.message}\n`);
  return 2;
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    raw += c;
  });
  process.stdin.on("end", () => process.exit(main(raw)));
}
