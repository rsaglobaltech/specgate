# Discover: reproduce-first

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Phase 2 of the trust curve (docs/specs/trust-curve.md): reproduce before
fixing. Teams that let agents triage errors make one rule non-negotiable: a
bug is fixed only once it has been seen failing. A fix with no reproduction
may change nothing, or the wrong thing, and passes its own test anyway.
Specgate opens a bug change (`propose --kind bug`) and lowers the module's
trust, but nothing asks for the bug to be seen red first, and nothing keeps
the proof that it was.

## Use case

1. A bug is reported in a module.
2. The Developer opens it with `specgate reproduce`: a bug change whose
   requirement says the behaviour the app should have, with the place in the
   app where it is reached; the module's trust drops.
3. The scenario is written, and run on today's code: it must fail. Its failure
   is kept as evidence.
4. The code is fixed, and `apply` accepts it only once the same scenario,
   seen red before, passes.

## Acceptance criteria

- AC-1: a reported bug opens a bug change in its module, with a requirement that must be reproduced, and lowers the module's trust.
- AC-2: the bug's scenarios are run on today's code; red is kept as evidence, green is refused as not reproducing it.
- AC-3: a requirement that must be reproduced is never delivered without its red evidence.
