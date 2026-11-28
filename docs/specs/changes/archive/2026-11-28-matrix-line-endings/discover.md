# Discover: matrix-line-endings

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project run on 2026-11-27, on Windows, checked out a fresh worktree of a
project whose matrix was current. git wrote the files with CRLF
(`core.autocrlf`), and `validate` failed at once: the matrix "no longer
matches". Regenerating it changed nothing git could show.

## Use case

The Developer clones or checks out a project on Windows; a current matrix is
current, whatever line endings git wrote.

## Acceptance criteria

- AC-1: a matrix that differs from the generated one only in its line endings is current.
- AC-2: a matrix whose rows differ is still stale.
