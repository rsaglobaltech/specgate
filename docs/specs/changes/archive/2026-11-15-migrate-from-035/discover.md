# Discover: migrate-from-035

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

`specgate migrate 1.0` was written while 1.0 was built on 0.27. The release
that comes before 1.0 is 0.35, which added a change's kind, the lanes under
the key 1.0 gives to people, and an environment variable agent scripts read.
A team on 0.35 must reach 1.0 the same way: one command, a report of what is
left to a person, and the project telling them when to run it.

## Use case

A team upgrades from 0.35, opens the project, is told to run the migration,
runs it, and gets a list of the scripts to change by hand.

## Acceptance criteria

- AC-1: Opening a 0.35 project names the migration, also when only its settings need it.
- AC-2: The migration keeps what 0.35 recorded on each open change.
- AC-3: What the migration cannot change is listed for a person, file by file.
