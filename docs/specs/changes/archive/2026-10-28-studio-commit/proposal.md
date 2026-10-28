# Proposal: studio-commit

## Intent

The studio writes the brief, approvals and answers into the project's files,
and the harness refuses to start on a tree with uncommitted changes. Someone
who never uses the terminal had no way to commit, so Build from the studio
failed after the brief was edited there.

## Scope

In scope:

- Committing the specification's files when a build starts from the studio,
  with the person's git identity.
- Refusing, with the files named, when other files are uncommitted.

Out of scope:

- Committing code, pushing, or any branch work: the harness does those.

## Approach

`startBuild` checks `git status --porcelain`; specification paths are staged
and committed, anything else stops the build with its list.
