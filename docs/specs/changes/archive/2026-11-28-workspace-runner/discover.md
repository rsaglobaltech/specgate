# Discover: workspace-runner

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A project run on 2026-11-27 keeps its browser tests in a workspace
(`apps/web`), with Playwright and playwright-bdd there and `bdd_cmd` an npm
script at the root. `doctor` said no Gherkin runner executes the scenarios
and never checked whether Playwright keeps screenshots; the evidence of a run
kept nothing, because the runner wrote `apps/web/test-results/`, not
`test-results/`.

## Use case

The Developer whose browser tests live in a workspace gets the same evidence,
and the same doctor advice, as one whose tests are at the root.

## Acceptance criteria

- AC-1: what the runner writes in a workspace's `test-results/` is kept as evidence, before and after.
- AC-2: doctor knows the scenarios run when `bdd_cmd` is set or a workspace has a Gherkin runner, and reads a workspace's Playwright config for screenshots and video.
