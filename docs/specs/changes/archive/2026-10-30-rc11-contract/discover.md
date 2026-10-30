# Discover: rc11-contract

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the ninth run of the 1.0 candidate over several repositories, every part was built and offered or used
the agreement's ways in exactly as written. The build accepted that code; the check over all the
repositories still said two of the service's ways in were missing, and that the agreements repository,
which offers nothing, offered none of its own.

## Use case

The check over all the repositories judges the code as the build does, so a person reading it is told only
what is really missing.

## Acceptance criteria

- AC-1: a way in that the code offers in two pieces, as the build accepts it, is not reported missing.
- AC-2: the agreements repository is not asked to offer its own agreements.
- AC-3: a way in that the code does not offer is still reported, naming the requirement.
