# Discover: lock-pid-reuse

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A run marks the working copy as its own while it works, and a run that died
without cleaning up does not keep it. But "died" was judged by the process
number alone, and the system gives a dead process's number to a new one: a
run that crashed could keep the project locked for as long as some unrelated
program held its old number. Left open in issue #466.

## Use case

A run is killed; later the machine reuses its process number; a person starts
a new run.

## Acceptance criteria

- AC-1: A run's mark on the working copy is not kept by an unrelated process that took over its number.
