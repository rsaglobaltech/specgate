# Discover: urbanops-run

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A municipal incident system (UrbanOps) taken from a client's brief to three
delivered requirements on 2026-11-27 showed four places where specgate said
something untrue: the brief check took "el operador determina si…" for a
condition placed last; the adoption baseline scenario, which no step runs,
would fail every full run once scenarios are executable; the evidence of work
done on main compared the code with itself and called it unchanged; and the
scenario refused with six photos was drawn as a success, because the code
refuses it with a generic exception thrown from a class's static operation.

## Use case

The person reading specgate's findings and evidence can believe them: no
warning on a correct rule, no run failing on a scenario nobody can run, and
a before and after that show what the change did.

## Acceptance criteria

- AC-1: "determina si", "evalúa si", "confirma si" and their English forms raise no B11 warning; a real late condition still does.
- AC-2: after `migrate bdd` the adoption baseline is skipped by the feature runner, and the gate warns while it is not.
- AC-3: evidence of a change delivered on main compares with the commit before the change was opened.
- AC-4: a scenario refused by a generic exception carrying its code or message ends at that throw, through static operations.
