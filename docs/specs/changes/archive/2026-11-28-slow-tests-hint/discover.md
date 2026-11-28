# Discover: slow-tests-hint

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project run on 2026-11-27 waited several minutes on every `apply`: the
whole suite, Testcontainers included, ran for each requirement. Specgate can
run only the requirement's tests (`test_cmd_affected` with `{files}`,
docs/fast-gate.md), but nothing told the project so, at the moment it paid
the cost.

## Use case

The Developer delivers a requirement and the suite was slow; the delivery
tells them, once, the command that makes the next one fast.

## Acceptance criteria

- AC-1: a delivery whose whole suite took two minutes or more names `test_cmd_affected` with the project's own command.
- AC-2: a quick run, or a command already scoped, says nothing.
