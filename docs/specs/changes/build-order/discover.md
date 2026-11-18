# Discover: build-order

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A person building a project from a brief with Codex saw the agent take REQ-002,
then REQ-022, and could not tell why (issue #482). The order followed the
modules' names alphabetically, not the order the brief lists them in — and a
brief usually lists first what the rest needs.

## Use case

A team writes its brief's modules in the order they should be built, and the
agent builds them in that order, saying why it took the requirement it took.

## Acceptance criteria

- AC-1: With a brief that lists its modules, requirements are built module by module in the brief's order.
- AC-2: What comes next says which module it belongs to and where that module stands in the brief.
- AC-3: Without a brief, the order is what it was.
