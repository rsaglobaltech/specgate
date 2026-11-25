# Design: person-approves

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/change/ChangeCommand.ts` (approve), `scripts/cli/commands/harness/CompatCommand.ts` and a new `scripts/lib/cli-reach.ts` (the exam). No other source file is added.

## Mechanisms

AC-1 — `cmdApprove` refuses with `approve_needs_person` when stdin is not a terminal and `SPECGATE_ASSUME_TTY` is not set — the same test `apply --steps-reviewed` makes (REQ-744). The studio's Review calls `approveChange` itself and is not touched. A terminal an agent makes for itself still passes: the guard refuses the command where hooks run (REQ-746), and the outside judge sees the approval changed (REQ-747). This is a speed bump, not the wall.

AC-2 — the exam's `bin/specgate` writes a mark to the run's scratch folder each time it runs, then does what its level says (the CLI under exam, or "not found"). Three things keep it first: `PATH`; `NPM_CONFIG_PREFIX` pointing to a prefix whose `bin` is that folder, so `npx --no-install specgate` finds it before the global one; and, for zsh, `ZDOTDIR` pointing to startup files that read the Developer's own and then put the folder first again. Before the agent starts, `cliReach` runs `$SHELL -lc 'specgate --version'` and `npx --no-install specgate --version` in the copy with the agent's environment; each must leave the mark. If one does not, the run is not started and is recorded as not run, with `compat_cli_not_under_exam` naming what answered. In a sandbox, at B, `command -v specgate` must find nothing.

## Decisions

The exam proves what it measures rather than trusting the PATH it set: a shell's startup files are the Developer's, and Specgate cannot know them all.
