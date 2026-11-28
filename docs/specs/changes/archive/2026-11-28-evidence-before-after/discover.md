# Discover: evidence-before-after

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The person reviewing a change today reads its delta and its code. A project
run on 2026-11-27 asked to see instead what each flow did before the change
and what it does after: for a screen, a picture of each and a short video of
the flow up to it; for a service, a diagram of the calls or the classes,
before and after. Specgate keeps a delivery's scenario run and, for browser
tests, what the runner left — the after only, in a folder nobody is pointed
to.

## Use case

1. The team approves a change; its scenarios run once, red, before any code,
   and that run is kept as the before.
2. Each requirement is delivered; its green run is kept as the after.
3. `specgate evidence <change>` writes one page for the change: per
   requirement, the before and the after side by side — screenshots for a
   screen, diagrams for a service — and where the videos are.
4. The pull request links the page; the reviewer starts there, and reads the
   code where the evidence shows risk.

## Acceptance criteria

- AC-1: a requirement's scenarios, run before its code, are kept as its before, with what the runner left.
- AC-2: a delivery keeps its after beside the before.
- AC-3: the project is told when its runner keeps no screenshots or video, and how to turn them on.
- AC-4: a requirement's scenarios and linked code are drawn before and after, the same way every time.
- AC-5: one page per change shows each requirement's before and after, and names what is missing.
