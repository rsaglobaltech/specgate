# Discover: config-agents

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The studio is to let the Developer choose, in one screen, the agent that
drafts, the agent of each module or requirement, and where the agents work —
and save it in the project for the whole team (2026-11-23: "Specgate Studio
has to be configurable"). Today some of it can only be written by hand in the
project's files: which module or requirement a profile serves, the sandbox
the agents work in, and removing a profile no longer wanted.

## Use case

1. The Developer gives a module or a requirement its own agent.
2. They say where the agents work: a sandbox per module, its kit, the hosts
   it may reach and what is installed in it.
3. They remove an agent of a module they no longer want, or any setting.

## Acceptance criteria

- AC-1: a profile can be made to serve a module or a requirement with one command.
- AC-2: the sandbox's engine, kit, hosts and setup can each be set with one command.
- AC-3: a setting, or a whole profile, can be removed with one command.
