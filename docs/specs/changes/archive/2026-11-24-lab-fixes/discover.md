# Discover: lab-fixes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Specgate was tried end to end on 2026-11-23: a real project built by three
agents in sandboxes, every phase of the trust curve exercised. It worked, and
it showed six places where what specgate promises and what the agent or the
person gets differ:

- The project's principles were checked only by `specgate check`: the agent
  never read them, and its gate never ran them. It complied by imitating code.
- With trust levels declared, chaining was refused outright, so two agents of
  one module started from the same commit and chose incompatible designs.
- `--dry-run` printed the prompt of a requirement the trust level would skip.
- The map linked a requirement to the scenario runner, whose comment held an
  example id, and to no real code.
- An exam told the agent its own criterion ("until `specgate check` passes"),
  so two versions of a skill scored the same.

## Use case

1. The agent reads the project's principles before it writes code, and its
   gate holds it to them.
2. A person chains a module's requirements on a branch of their own, and
   merges that branch when they choose.
3. A dry run shows what a real run would do.
4. The map names the code that delivers a requirement, not the tools that
   check it.
5. An exam judges the agent by a check the agent did not see.

## Acceptance criteria

- AC-1: the harness prompt carries the principles; the harness gate fails on a principle that fails.
- AC-2: with trust declared, `--chain` works on a branch that is not the project's main branch.
- AC-3: a dry run says which requirements would be skipped, and why.
- AC-4: the gate's own commands, and exam fixtures, are not code or tests of any requirement.
- AC-5: an exam task can hold a check the agent never sees.
