# Discover: domain-docs-refresh

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A person trying specgate on a project found `actors.md` and `glossary.md`
never changed. The actors diagram was drawn only from the actors a brief
declares — a project adopted from its code has requirements with an actor
long before it has a brief — and nothing said why it stayed as `init` wrote
it. The glossary is the team's to write, but nothing helped them start it.

## Use case

A team adopts specgate on an existing project, writes requirements with
`actor=`, and wants the actors diagram and a first glossary.

## Acceptance criteria

- AC-1: The actors diagram is drawn from the requirements' actors when no brief names any, and kept current as requirements are delivered.
- AC-2: When it cannot be drawn, the person is told why.
- AC-3: The person can see which names the project uses that the glossary does not define, and start a row for each.
