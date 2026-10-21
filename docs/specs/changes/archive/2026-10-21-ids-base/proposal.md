# Proposal: ids-base

## Intent

Found rehearsing a gitflow project with two developers: `check` compared ticket keys with `develop` (the `pr: base:` of `alm.config.yaml`, REQ-148) but compared requirement ids with the remote's default branch. With `main` as the default, a REQ id taken on `develop` and not yet released was invisible to the id check, and the two lines of `check` named two different bases.

## Scope

REQ-120: the base for ids is resolved like the base for ticket keys — `--base`, `SPECGATE_BASE`, `pr: base:`, then the remote's default.

## Out of scope

Reading the branch a ticket's branch was cut from; nothing records it.
