# ADR-0042: A short alias, sgate, for the same command

**Date:** 2026-11-15  
**Status:** Accepted  

---

## Context

`specgate` is typed dozens of times a day, and eight letters is long for that.
[ADR-0032](0032-one-name-everywhere.md) removed the binary alias `csda` because
it was another name: a newcomer met two products. A shorter spelling of the
same name does not have that cost.

The obvious short form, `sg`, is taken twice: `sg` (switch group) ships with
the shadow utilities on almost every Linux, and `sg` is ast-grep's binary. An
alias that shadows a system command, or is shadowed by it, is worse than none.

## Decision

The package installs `sgate` next to `specgate`, the same entry point. It is an
abbreviation of the name, not a second one: the documentation, the help and
every message keep saying `specgate`; one line in the getting-started guide and
the command reference names the alias, and `specgate completion` completes both.

## Consequences

- A user types `sgate apply` instead of `specgate apply`; nothing else changes.
- `sgate` must stay free of system commands: if a common platform ships one,
  this decision is revisited rather than the alias kept.
- Examples never use `sgate`, so a reader who skipped the one line about it is
  never confused.
