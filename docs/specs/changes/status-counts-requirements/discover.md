# Discover: status-counts-requirements

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A requirement written with two scenarios showed in the daily view as two
requirements: "0 of 2 done", and the same line twice under what is left to do.
Seen on both trial projects during the first run with a real agent. People
count requirements; the view was counting the scenarios under them.

## Use case

A developer opens the daily view to see how many requirements are done and
which is next, and reads each requirement once.

## Acceptance criteria

- AC-1: The progress line counts each requirement once, however many scenarios it has.
- AC-2: A requirement is counted as done only when all of its scenarios are.
- AC-3: Each list names a requirement once.
- AC-4: What other programs read from the daily view is unchanged.
