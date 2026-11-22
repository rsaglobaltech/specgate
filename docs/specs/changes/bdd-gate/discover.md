# Discover: bdd-gate

## Context

The Developer built two requirements of a module and no feature file existed: specgate wrote them only at archive, and nothing ran them. specgate's sense is a gate that always holds: the scenarios must be executable before the code is written (BDD), and the code written test first (TDD). The Developer chose: required in every project, existing ones migrated.

## Acceptance criteria

- AC-1: an approved change's scenarios are feature files before any code.
- AC-2: the gate requires a runner for them and their files up to date, in every project that says so; the others are told to migrate.
- AC-3: apply runs the requirement's scenarios and refuses when they fail.
- AC-4: new, adopted and migrated projects are set up for it.
