<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# ADR-0002: Use Bash for the project initialisation script (superseded by ADR-0006)

**Date:** 2024-01-15  
**Status:** Superseded by [ADR-0006](./0006-node-engine-for-init.md) (Phase 2)  
**Deciders:** Core maintainers

---

## Context

The `init` command needs to parse a config file, render templates with variable substitution, and write a file tree. The initial implementation had to ship quickly and the author was most fluent in shell scripting.

## Decision (original)

Implement `new_spec_project.sh` in POSIX-compatible Bash with `sed` for variable substitution.

## Rationale (original)

- No Node.js module installation required at bootstrap time.
- Shell is universally available on Linux and macOS.
- Template substitution via `sed -e 's/{{VAR}}/value/g'` is simple and transparent.

## Consequences (original)

- **Positive:** Zero runtime dependencies; easy to read and modify for shell-fluent contributors.
- **Negative:** Breaks on Windows without WSL; `sed` patterns are fragile with special characters; untestable with `node:test`; forces use of Bats for shell tests.

## Why superseded

The cross-platform requirement (REQ-004) and the adoption of Bats/ShellCheck made the shell approach a maintenance liability. ADR-0006 documents the migration to a deterministic Node.js engine.
