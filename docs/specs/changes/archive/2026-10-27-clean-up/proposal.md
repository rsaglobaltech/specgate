# Proposal: clean-up

## Intent

Taking a brief to a delivered web app left a list of smaller defects behind: a status command that printed `<module>`, a DRAFTING.md that offered 25 requirements in a range of 10, code spans split across changelog lines, ranges that silently stopped growing, delivered requirements returned to Draft that the harness would only re-mark, twenty screen requirements passed with no screen, a harness template that hid the live view, a question the live view showed but could not take an answer to, ids reserved from a mention in a scenario's text, and a Cucumber gate, four tests and two recorders that did not work on Windows.

## Scope

In scope:

- REQ-193 to REQ-202: each defect above, with its test.
- The release process says why the push to `main` bypasses its checks.

Out of scope:

- Recording the documentation's terminal on Windows: its transcripts are POSIX by design; the recorders say so.
- Running the post-merge gate in its own worktree (see REQ-186).

## Approach

Each fix is local to the command it concerns; the two that cross commands — screen requirements and rework — read the same specification files the gate already reads, and studio's one write goes through the code `specgate answer` uses.
