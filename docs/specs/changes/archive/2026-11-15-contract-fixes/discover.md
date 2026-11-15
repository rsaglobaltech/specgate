# Discover: contract-fixes

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Tools built on Specgate — specgate-studio first — read its answers to show a
team where a project stands. Auditing specgate-studio against 1.0 found three
places where a tool had to guess: a broken settings file answered as empty
settings, whether a change may be built was only an old line that an edit can
make stale, and the next step was a sentence a tool had to take apart.

## Use case

A tool opens a project, shows its settings or why they cannot be read, shows
which changes may be built and which wait for an approval, and offers the next
step as a button that runs it.

## Acceptance criteria

- AC-1: A settings file that cannot be read is said, with how to fix it.
- AC-2: Whether a change may be built is answered by what its approvals say today.
- AC-3: The next step is given as data a tool can run, not only as a sentence.
