# Discover: first-green-gate

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

One timed run of the documented path for a project that already has code, on
a Python service, on 2026-11-20. The commands took under a minute; three
things stood between the team and a first green gate. The pipeline that was
written for it prepared the language and installed nothing the tests need, so
its first run would fail. Delivering the first requirement was refused twice,
for one reason each time, neither mentioned on the start page. And the
requirement written at adoption — existing behaviour is preserved — stayed in
the list of work to do for good, and nothing there said how to close it.

## Use case

A team with working code adopts the tool, writes down one behaviour, and sees
it delivered and the pipeline green, without a failure it could not have
foreseen.

## Acceptance criteria

- AC-1: The pipeline written for a Python project installs what its tests need, as far as the repository states it, and says so where it cannot tell.
- AC-2: Delivering a requirement that still holds what the tool wrote says everything to rewrite in one refusal, and the start page names that step.
- AC-3: The requirement written at adoption of existing code is shown as held by the test suite, apart from the work to do and not counted in it, with the way to close it.
