# ADR-0028 — Architecture conformance is part of the gate

## Status

Accepted — 2026-10-07

## Context

The gate proves that a requirement has a scenario, that the scenario has real
steps and that a test names it. It says nothing about *where* the code went.
An agent that makes a test pass by putting business logic in a controller, or
by importing a layer it should not, delivers a green change that degrades the
project. That is the same kind of lie the gate already refuses for scenarios:
work that looks done and is not right.

Teams already have tools for this, one per language: ArchUnit and Konsist on
the JVM, ArchUnitNET and NetArchTest on .NET, dependency-cruiser and ArchUnitTS
for TypeScript, import-linter for Python, go-arch-lint for Go, Deptrac for PHP,
and Semgrep across all of them. The teams this tool serves work in several
languages, and a rule engine of its own would cover none of them as well.

On an existing codebase every one of those tools fails on day one. Specgate's
adoption story — green the day you adopt it, stricter with every delivery —
would not survive a gate that is red until the architecture is fixed.

## Decision

1. **Specgate runs the team's architecture tool; it does not replace it.**
   `harness.config.yaml` gains `arch_cmd`, beside `test_cmd`. It is any shell
   command, the way the harness's agent is any shell command.

2. **It runs wherever the gate runs:** `specgate check` (locally and in CI,
   after `validate --strict` and before the tests), `specgate done`, and the
   harness gate, whose failure is fed back to the agent like any other.

3. **A baseline, so adoption is not a wall.** `specgate arch baseline` records
   the current violations; afterwards only *new* ones fail. This is ArchUnit's
   freeze idea made tool-independent: the debt is visible, and it cannot grow.

4. **SARIF when the tool speaks it.** A tool that writes SARIF has each
   violation reported with its file, line and rule, and the baseline compares
   findings rather than exit codes. A tool that does not is judged by its exit
   code, and the baseline cannot apply to it — the gate says so.

5. **Architecturally significant use cases must be covered.** With the
   use-case layer on (ADR-0027), a use case flagged significant cannot be
   delivered while no `arch_cmd` is configured.

6. **Later, one rule only Specgate can check:** a use case declares the
   entities it touches; its code imports others. That needs each language's
   import graph, which several of the tools above already export. It is a
   separate phase and does not block the rest.

## Consequences

- `check` becomes specification + architecture + tests. Without `arch_cmd`
  nothing changes, and `check` says the architecture was not checked, the way
  it says so today for tests.
- Nothing in Specgate depends on any one architecture tool, and the docs carry
  one recipe per language rather than one rule language.
- The baseline is a committed file; reviewers see when it grows, and the gate
  refuses it growing without `--accept-new`.

## Alternatives considered

- **A Specgate rule language translated to each tool.** One more language to
  learn, and always behind the tools it translates to.
- **Leave architecture to CI.** Then the harness approves an agent's change
  that CI later rejects — the gap ADR-0026 closed for tests.

## References

- [The use-case model — specification](../use-case-model.md), §Architecture
- ADR-0026 — The default gate is the strong gate; ADR-0027 — Use cases are a layer
