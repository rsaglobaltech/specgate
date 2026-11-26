# Discover: person-approves

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The exam of 2026-11-25, run again after outside-judge, found two things left.

1. An agent with no hooks in its tool — Codex — ran `specgate change approve`
   on the change it had just written, and the command approved it. Only the
   outside judge saw it. Approving is a person's act, and the command took
   anyone's word.
2. The exam's own measurements went wrong twice on the Developer's machine. A
   login shell put the `specgate` installed for every project ahead of the one
   under exam, so the agent ran an older Specgate; and the gate hook, which
   starts the CLI through `npx`, found the older one too. A fix for that put a
   working `specgate` in front of the baseline as well, where the exam promises
   none. Nothing told the run.

## Use case

1. A person approves a change at their own terminal, or in the studio's Review, as before.
2. An agent's tool, which runs its commands with no terminal, asks to approve: it is refused, and told the act is a person's.
3. Before an agent of the exam starts, the exam asks the agent's own shell, and the `npx` its hooks use, which `specgate` they reach; a run whose agent would reach anything but what its level gives it does not start.

## Acceptance criteria

- AC-1: `change approve` with no terminal is refused, saying it is a person's act; at a terminal, and in the studio, approving is as before.
- AC-2: an exam run starts only when the agent's login shell and `npx` reach the `specgate` its level gives — the one under exam with Specgate, none at the baseline — and otherwise says what they reached.
