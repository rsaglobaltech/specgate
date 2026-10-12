<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# ADR-0006: Node.js Engine for `init` (supersedes ADR-0002)

**Date:** 2026-05-12
**Status:** Accepted
**Supersedes:** [ADR-0002 — Bash for Init Script](0002-bash-for-init-script.md)

## Context

ADR-0002 chose Bash for the `init` command because it is available on every Unix system
without extra runtime requirements. Since then two concerns have emerged:

1. **Cross-platform gap.** Windows users (Git Bash excluded) cannot run `.sh` scripts natively,
   blocking adoption in enterprise environments where Windows dev machines are common.
2. **Maintainability.** The Bash script grew to ~491 lines of `sed`-heavy template rendering.
   Unit-testing Bash at that granularity requires Bats mocking that is awkward to maintain.

## Decision

Introduce a Node.js port of `new_spec_project.sh` as `scripts/init_project.js`, selectable
via the `--engine=node` flag on the `init` command. The Bash engine remains the default for
existing users (no breaking change).

The Node engine:
- Parses the same `KEY="value"` config format.
- Uses the same `{{VAR}}` placeholder substitution already in `scripts/domain-pack/common.js`.
- Applies the same Docker/devcontainer flags, traceability-coverage logic, and git init.
- Exits with the same status codes (0, 2, 4).
- Produces an output directory that passes `validate` identically.

## Consequences

**Positive:**
- Windows smoke tests pass in CI without a Bash dependency.
- The Node engine is fully unit-testable with `node:test` (parity tests in
  `tests/unit/init-engine-parity.test.js`).
- Prepares for ADR-0007 (flip default to Node in a future release).

**Negative:**
- Two init code paths to maintain until the Bash engine is deprecated.
- Node ≥18 required (already the stated minimum in `package.json`).

## Alternatives considered

- **Deprecate Bash immediately.** Rejected — breaking change for Linux/macOS CI pipelines
  that already rely on the shell engine.
- **Use a cross-platform shell library (zx).** Rejected — adds a runtime dependency and does
  not improve testability over plain Node.js.
