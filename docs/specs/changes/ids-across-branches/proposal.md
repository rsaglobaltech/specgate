# Proposal: ids-across-branches

## Intent

Found working on a real board: KAN-14 and KAN-13, opened on two branches,
both reserved REQ-002. Each branch allocated ids as max + 1 over its own
checkout; ADR-0036's `id_taken_on_base` only catches the collision against
the base, after one of them is merged. With one change per ticket, parallel
branches are the normal case, not the exception.

## Scope

In scope: id reservation and the first scenario number read the changes of
every local and remote-tracking branch (REQ-152).

Out of scope: renumbering ids already minted.
