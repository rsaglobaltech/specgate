#!/usr/bin/env node

/**
 * The `SessionStart` hook: a new session starts knowing the project is
 * spec-driven, which change is open and what comes next (REQ-420).
 *
 * `AGENTS.md` says all of this too, but a session reads it as one file among
 * many. This puts the open change and its next requirement in the context
 * before the first prompt, so the agent starts from the loop instead of from
 * the code.
 *
 * Contract: stdin is JSON with `cwd`; what the hook prints on stdout with
 * exit 0 is added to the session's context. Anything unexpected prints
 * nothing and exits 0.
 */

import { isSpecDriven, openChanges } from "./project-state";

/** Keep the context short: it is read before every first prompt. */
const MAX = 2000;

/** What a session in `cwd` is told, or "" outside a spec-driven project. */
export function sessionContext(cwd: string): string {
  try {
    if (!isSpecDriven(cwd)) return "";
    const changes = openChanges(cwd);
    const lines = [
      "This project is spec-driven (specgate). Its contract is `spec.md`, `features/` and `docs/specs/`; work is judged against them.",
      "",
    ];
    if (!changes.length) {
      lines.push(
        "No change is open. New behaviour starts with `specgate propose <change-id>` and its delta, before any code."
      );
    } else {
      for (const c of changes) {
        const left = c.pending.length
          ? c.pending.join(", ")
          : "none — ready for review and archive";
        lines.push(`Open change \`${c.id}\` — still to apply: ${left}.`);
      }
      const next = changes.flatMap((c) => c.pending)[0];
      if (next) {
        lines.push(
          "",
          `Next: ${next}. Write the test first and name ${next} in it, then the code, then \`specgate apply ${next}\`.`
        );
      }
    }
    lines.push(
      "",
      "Rules: one requirement at a time; write the test first, naming its REQ-NNN; `specgate check` before saying it is done; never edit the specs to make a test pass; never archive a change without the person who reviews it."
    );
    const text = lines.join("\n");
    return text.length < MAX ? text : `${text.slice(0, MAX - 2)}…`;
  } catch {
    return "";
  }
}

export function main(raw: string): number {
  let cwd: string;
  try {
    cwd = (JSON.parse(raw) as { cwd?: string }).cwd ?? process.cwd();
  } catch {
    return 0;
  }
  const text = sessionContext(cwd);
  if (text) process.stdout.write(`${text}\n`);
  return 0;
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    raw += c;
  });
  process.stdin.on("end", () => process.exit(main(raw)));
}
