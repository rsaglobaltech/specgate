# Proposal: removed-in-flight

## Intent

Issue #432. While a change that removes a delivered requirement is open,
`specgate check` judges the project as it will be after archive (the
requirement gone, so its feature file must be too), and `specgate validate
--strict` judges the tree as it is (the requirement still delivered, so its
feature file and test must exist). No state of the tree passes both, `apply`
of the change's other requirements is refused, and the agent's stop hook fails
every turn until the change is archived.

## Scope

In scope:

- `validate` judges a requirement an open change removes as it judges a
  `Deprecated` one: its files may already be gone, and it owes nothing.

- The after-archive copy keeps a symlink as a symlink: reproducing #432 on a
  worktree with a linked `node_modules`, `check` died copying it.

Out of scope:

- `check`, which already judges the after-archive view.

## Approach

`validate` reads the matrix, compares a generated one with what it generates,
then judges a copy of it in which each requirement an open change removes
carries the status `Deprecated`.
