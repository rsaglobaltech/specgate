# Discover: rc9-live

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the seventh run of the 1.0 candidate over several repositories, the workspace's live view showed each
repository's requirement in flight, its step and its cost, but not the detail a single repository's live
view shows: the work waiting, the agent's console, each attempt and the gate. To follow one repository the
viewer had to start a second view in that repository.

## Use case

From the workspace's live view the viewer opens one repository and sees its live view as that repository
shows it, kept current as its build goes on, with a way back to the workspace; a repository the workspace
does not know, or whose folder is missing, is said so.

## Acceptance criteria

- AC-1: each repository of the workspace's live view opens that repository's own live view — the work waiting,
  the console, attempts, gate and cost — kept current while it builds, naming the repository and its role and
  leading back to the workspace.
- AC-2: the workspace's live view leads to each repository's.
- AC-3: a repository the workspace does not have is refused with the ones it has; a repository whose
  folder is missing is said to be missing.
