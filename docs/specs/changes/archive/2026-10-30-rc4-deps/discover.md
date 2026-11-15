# Discover: rc4-deps

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the third run of the 1.0 candidate over several repositories, the screen's part of the story said in
its design which parts of the other repositories it waits for, but the requirements the build is judged
by said nothing of it, and the check called the change ready. The repository meant to hold the agreements
between the others described them in its requirements and never wrote them down, so no requirement could
point at one.

## Use case

An architect writes in the design what a part waits for; the check says which requirement does not carry
it yet. The agent writing the agreements' repository writes the agreements themselves, and every part
points at the one it uses.

## Acceptance criteria

- AC-1: a part the design says a requirement waits for, and that no requirement of the change carries, is
  named by the check, with the requirement it belongs to when the design says so.
- AC-2: the same holds for an agreement the design says a requirement uses.
- AC-3: the repository that holds the agreements is asked to write them and to point each requirement at
  its own; the other repositories are asked to point at the ones they use.
