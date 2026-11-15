# Discover: layered-outputs

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The pages for the business — the review, the acceptance, the release notes —
were built on 0.35's changes, which said why in a proposal. A 1.0 change says
why in its Discover and lists what the business accepts as numbered criteria;
the pages showed neither, and a module read from existing code arrived as a
0.35-style change.

## Use case

A product owner opens the review of a change and reads why it exists and what
it must do, criterion by criterion; later checks each criterion in the
acceptance and signs. Release notes say why each change shipped.

## Acceptance criteria

- AC-1: The review shows the change's why and each of its acceptance criteria.
- AC-2: The acceptance asks a person to check each acceptance criterion.
- AC-3: Release notes give each change's why, whichever version wrote it.
- AC-4: A module read from existing code arrives in the three layers.
