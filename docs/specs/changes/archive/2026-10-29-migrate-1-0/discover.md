# Discover: migrate-1-0

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A team on 0.27 has changes in progress when it moves to 1.0. 1.0 reads them,
but writes every new change in three layers with an owner each, and the other
1.0 features (roles, approvers) ask for things 0.27 never had. Without a guided
step, each team upgrades its open changes by hand and finds out what is
missing one warning at a time.

## Use case

The person runs one command on a clean project. It upgrades every change still
in progress, never one already delivered, says what it did and what is still
theirs to do, and does nothing the second time. They can see all of it first
without anything changing. The daily status tells them once that the command
exists.

## Acceptance criteria

- AC-1: every change in progress written for 0.27 is upgraded to the three layers, with the business text kept word for word
- AC-2: a delivered change is never rewritten
- AC-3: a preview changes nothing and says exactly what the real run would do
- AC-4: running it again does nothing
- AC-5: it refuses on a project with uncommitted work
- AC-6: a report names what was done and what a person must still do, and a later 1.0 step is added in one place
- AC-7: the daily status names the command while a 0.27 change is open
