# Design: agent-runs-tests

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/lib/agent-permission.ts`, `scripts/cli/commands/harness/RunCommand.ts`,
`scripts/harness/prompt.ts`.

## Mechanisms

- AC-1 — `withTestPermission(command, testCmd)` adds
  `--allowedTools "Bash(<part>:*)" …` right after `--permission-mode
acceptEdits`, one rule per part of the test command (split on `&&`, `||`,
  `;`). It applies to Claude Code in print mode with `acceptEdits`, whether
  the harness added that flag or `harness.config.yaml` carries it. A part a
  rule cannot carry safely inside double quotes (quotes, `$`, pipes,
  placeholders) is left out. Checked against Claude Code 2.1.329: the test
  command runs, `npx vitest run` beside it is refused.
- AC-2 — `buildPrompt` takes `testCmd` and adds one rule to the prompt's
  rules: the parts to run, exactly as written, and to see the new test fail
  first.
- AC-3 — `harness run` prints `Claude Code may run the test command and no
other: …`.
- AC-4 — a command with `--allowedTools`, `--allowed-tools` or
  `--dangerously-skip-permissions` is returned unchanged.

## Risk accepted

A test command runs code the agent wrote. That was already true of the gate,
which runs the same command on the same worktree after the agent ends.

## Not in this change

The agent's last message in the text report; money in `harness report`; the
prompt file on the harness branch.
