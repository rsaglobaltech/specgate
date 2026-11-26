# Discover: sync-keeps-local

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A walkthrough of the tutorial on 2026-11-26 upgraded the domain pack from
v0.1.0 to v0.2.0. `specops sync` said "6 updated · no conflicts" and, in
`spec.md`, dropped the `status=Implemented` that `apply` had written on a
requirement the pack had not changed. A team that upgrades its pack loses the
record of what it delivered, and is told nothing was in conflict.

## Use case

1. A team delivers requirements of a pack-derived project.
2. It upgrades the pack.
3. What the new version changes arrives; what the team wrote — a status, a
   field, a requirement of its own — stays; where both changed the same
   thing, sync says so.

## Acceptance criteria

- AC-1: upgrading a pack keeps every local edit in `spec.md` the new version does not touch, and brings every change it makes.
