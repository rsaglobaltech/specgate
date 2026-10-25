# Proposal: adopter-papercuts

## Intent

Three small things an adopter hit on a first project, each costing a detour. A brief written in the first person ("Soy hispanohablante… quiero una web personal") was warned that its one declared actor is never named, though every line is that actor speaking. `harness init --project-dir .`, run to register the merge drivers, refused because the prompt prefix it tells you to edit had been edited, and `--force` would have thrown the edit away. `validate --strict` with no directory printed the whole CLI's help instead of the one line that answers it.

## Scope

B9 does not warn about the one actor of a brief written in the first person, and its fix says so when there are several. `harness init` keeps an edited `.harness/prompt-prefix.md` and says it did; `--force` still replaces it. `validate` without a directory says `specgate validate .` with the flags given.

## Out of scope

Validating the current folder when no directory is given: `validate` is the gate, and its one positional argument stays explicit.
