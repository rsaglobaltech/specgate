# Discover: semver-contract

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

1.0 promises that nothing a team, a script or a tool relies on breaks within
1.x. Until now that rested on care: a command, a flag, a code or a key of an
answer could disappear in any release, and the build said nothing. Tools built
on Specgate — specgate-studio first — cannot plan around a promise nobody
checks.

## Use case

A maintainer merges a change; if it would remove something a user relies on,
the build says what and stops it. To retire something, they deprecate it in a
minor release and remove it in the next major.

## Acceptance criteria

- AC-1: Removing or retyping anything users rely on fails the build within a major version.
- AC-2: Adding to it passes, and the release that ships it is at least a minor.
- AC-3: A removal in a major passes only after the item was deprecated.
- AC-4: What is promised, and how it is kept, is written for users.
