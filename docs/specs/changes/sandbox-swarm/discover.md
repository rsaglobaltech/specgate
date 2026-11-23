# Discover: sandbox-swarm

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

On 2026-11-23 a real project was built by three agents, each in its own
sandbox, one per module. It worked, and every step of it was done by
hand: a clone per module, a sandbox per clone, its network opened, Node
installed inside, the harness started in each, the branches brought back.
Afterwards the sandboxes stayed, with their network rules — and those rules
were not only the two hosts opened on purpose: the sandbox's kit had added
twenty-nine of its own, which nobody had seen.

## Use case

1. The Developer says the agents run in sandboxes, which hosts they may
   reach, and what to install in each.
2. The harness gives each module of a change its own sandbox, made once and
   used for every requirement of that module.
3. The Developer sees every sandbox: its change, its module, and every host
   it may reach — the ones they opened and the ones the sandbox brought.
4. When the change is archived, its sandboxes go, with their rules. A
   sandbox left behind is found and removed with one command.

## Acceptance criteria

- AC-1: the agents of a run work inside sandboxes, one per module of a change, set up once.
- AC-2: each sandbox reaches only the hosts the Developer allowed, plus what its kit adds — and both are shown.
- AC-3: archiving a change removes its sandboxes and their rules.
- AC-4: no sandbox is left behind unseen: listed, and removed with one command.
