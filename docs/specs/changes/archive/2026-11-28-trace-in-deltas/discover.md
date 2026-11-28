# Discover: trace-in-deltas

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Archiving the 1.7.0 changes wrote `actor=Product` into the spec where the
delta said `actor=Product owner`: the warning for a value cut at a space
read the specs, never a change's delta, so nothing said so before archive.

## Use case

The author of a change learns of a cut trace value while the change is open,
not after it is archived.

## Acceptance criteria

- AC-1: `change validate` warns about a delta's trace value cut at a space, with the quoted form; a quoted value is quiet.
