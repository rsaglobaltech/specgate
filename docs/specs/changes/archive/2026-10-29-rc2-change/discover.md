# Discover: rc2-change

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The first run of the 1.0 candidate over several repositories (truck-flote, three of them) found the change
workflow saying yes and then no: a change that validated was refused at approval, a scripted `init`
made a second project inside the first, three requirements sharing one feature file lost scenarios
without a word, and the developer's task list stayed unticked after every requirement was delivered.

## Use case

A person drafts a change, validates it, approves it and lets the harness build it; each step says
the same thing the next one will, and the task list ends ticked.

## Acceptance criteria

- AC-1: `init --yes` in a folder with code adopts it, as plain `init` does.
- AC-2: what approval refuses, validation reports first.
- AC-3: the agent writing a change's requirements is asked for their kind and actor, one feature file each.
- AC-4: two requirements naming one feature file are reported.
- AC-5: a delivered requirement ticks the tasks that name it.
- AC-6: the change command's help describes the three layers.
