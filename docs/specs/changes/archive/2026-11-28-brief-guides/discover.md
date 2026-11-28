# Discover: brief-guides

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project run on 2026-11-27 reported that the `draft` skill told the agent to
follow `docs/specs/BRIEF-SETUP.md` and `docs/specs/BRIEF-CARDS.md`, and neither
existed: the first is not written while the front matter has problems, the
second only when Specgate calls the agent itself. The agent read Specgate's
source to learn the format of a module section. Writing the files on every run
is no answer: a brief without sections is valid, and a guide left behind is an
untracked file the harness refuses to start on (REQ-260).

## Use case

The agent, told the brief needs a front matter or module sections, asks
Specgate for the guide and gets it on the spot, wherever the brief lives.

## Acceptance criteria

- AC-1: either guide is printed on request, and nothing is written.
- AC-2: the `draft` step, and what `propose --from-brief` reports, name the request instead of a file.
