# Discover: sealed-acceptance

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The exams of 2026-11-25 measured two gaps that no control closes today.

1. On the trap tasks — a change whose own test is wrong — an agent with
   Specgate did no better than one without it. The agent writes the code and
   the test that judges it, so a wrong test is followed, or written, by the
   same hand.
2. Kimi passed a gate with code that did not do the work: it wrote one function
   for the product and another for the step definitions, and the scenarios ran
   green against the second.

Both come from one thing: the agent that implements a requirement also writes
its oracle. Specgate cannot read a requirement and know a test is right — a
Java project with complex business rules is past any grammar — but it can say
who may write the oracle, and keep the others out.

## Use case

1. A person approves a change's discover and design, as today.
2. Someone other than the agent that will implement it — a person, or another
   agent that sees only the specification and the design's interfaces — writes
   the change's acceptance tests in the project's own test language, and lists
   each with the scenario it proves.
3. A person reads them against the scenarios and approves them. From then on
   they are part of the approved contract.
4. The agent implements the change. It may write its own unit tests; it cannot
   change an approved acceptance test, by any road.
5. The gate runs the approved acceptance tests with the project's own command;
   red is red, and the fix is in the code.
6. If an acceptance test must change, that is a change of contract: a person
   approves it again.

## Acceptance criteria

- AC-1: a person approves a change's acceptance tests, each naming a scenario of the change; the approval records each file as it is, and only a person at a terminal or in the studio can give it.
- AC-2: an approved acceptance test that is changed or gone fails the gate until it is restored or a person approves it again.
- AC-3: the gate runs the approved acceptance tests with the command the project names, and installs nothing; a project that has approved tests and no command is told so.
- AC-4: an agent's tool cannot write an approved acceptance test — not by its file tools, its patch tool or its shell — and a change made anyway is seen by the one who judges the run.
- AC-5: the exam shows it: the recorded two-function attack, replayed with no model, is refused or caught every time; and on the trap tasks, agents whose acceptance tests were written by a separate writer that sees no source deliver no wrong work.
