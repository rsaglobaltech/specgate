# Discover: compat-honest

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The first batch of hard tasks (2026-11-24, 120 runs) said things that were not
true. 23 of OpenCode's 40 runs lasted a second: its provider answered "Free
usage limit reached" and the exam recorded an agent that failed. And the batch
showed a hole it could not measure: Codex built the numbers of a wrong test,
and `specgate check` passed — the gate saw a test that names the requirement
and passes, not that it says what the scenario says. Specgate can run the
scenarios themselves; nobody had measured whether that closes the hole.

## Use case

1. The Developer runs a batch; a tool whose provider refuses it is said to have not run, and the batch stops asking it.
2. The Developer runs the trap with the scenarios executed by the gate, and reads whether the wrong numbers still pass.
3. Before a release, the Developer runs the exam and the release is refused without a recent one.

## Acceptance criteria

- AC-1: a run in which the tool never worked is invalid, not failed, and is left out of every cell.
- AC-2: after two invalid runs in a row a tool is not asked again in that batch, and the report says so.
- AC-3: the trap exists with the gate requiring executable scenarios, judged as the trap is.
- AC-4: a release check says whether the exam was run with this version of Specgate, and which cells are not green.
