# Discover: uml-evidence

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Shown the evidence page of a real project on 2026-11-27, the person asked for
its diagrams to be the standard UML a modelling tool such as Visual Paradigm
draws: a class diagram one class per requirement file, with bare member names
and every class marked "new" in a note, and a sequence diagram of the actor
and one "System" box, told them little a reviewer could check against the
code.

## Use case

The reviewer opens the evidence page and reads the requirement's design as
UML: the classes it touches with their typed attributes and operations, how
they relate, and, for each scenario, which object calls which, in order.

## Acceptance criteria

- AC-1: one class diagram per language for the requirement's slice of the code: typed attributes and operations with visibility, stereotypes (interface, record, enumeration with its literals, abstract), associations with multiplicity, dependencies, generalizations and realizations; what changed since the base is coloured and named under it.
- AC-2: a scenario whose call reaches the code is drawn from the code: one lifeline per object, each call with its parameters and its reply with what it returns, activations, numbered; a scenario through a screen starts at the web app.
- AC-3: a scenario the code does not answer keeps the diagram from its steps.
