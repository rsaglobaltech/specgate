# Discover: adopt-no-code

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A person tries the tool in an empty folder. Adoption tells them, and their
agent, three things that are not true: that this is an existing project, that
it exposes its behaviour in a style nobody chose, and that its first requirement is to
preserve existing behaviour — which nothing can meet or test, since there is
no behaviour. An adopted project with code is told the same,
whatever it is. Issue #513.

## Use case

A person adopts an empty folder and reads a contract and a specification that
describe a new project: nothing invented, and a first requirement the first
test meets.

## Acceptance criteria

- AC-1: A folder with no code is set up as a new project, and adoption says so.
- AC-2: The contract and the specification state no interface style nobody chose: undecided where there is no code, as built where there is.
- AC-3: Where there is no code, the first requirement is one the first test meets, and the status says to add the first thing the product should do.
- AC-4: A folder with code is adopted as before: an existing project, whose first requirement preserves its behaviour.
