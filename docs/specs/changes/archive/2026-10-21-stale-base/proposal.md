# Proposal: stale-base

## Intent

Found rehearsing gitflow with two clones: `pr.base: develop` resolved to the local `develop`, which a developer rarely updates. Behind `origin/develop`, it made every colleague's commit merged from `origin/develop` look like this ticket's (`ticket_key_missing`), and would cut the next ticket's branch from old code.

## Scope

REQ-148: `pr.base` resolves to the local branch only when it already contains `origin/<base>`; otherwise to `origin/<base>`. The ticket's branch is created without tracking its base, so it never pulls from or pushes to `develop` by default.
