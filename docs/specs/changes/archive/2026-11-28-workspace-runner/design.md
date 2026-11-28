# Design: workspace-runner

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

New `scripts/lib/workspaces.ts`; `scripts/lib/evidence.ts`, `scripts/cli/commands/quality/DoctorCommand.ts`, `packages/core/src/domain/TestCommand.ts`, and their tests.

## Mechanisms

`workspaceDirs(projectDir)` reads `workspaces` from the root `package.json` (an array, or `{ packages }`), each entry a folder or a folder ending in `/*`, and returns the folders that exist, relative to the project.

AC-1 — `keepArtifacts` copies the files changed since the run from `test-results/` and from each workspace's `test-results/`; a workspace's land under `artifacts/<workspace>/`.

AC-2 — the scenarios line counts a runner when `bdd_cmd` is set, or when the root or a workspace has one; `hasGherkinRunner` also knows `playwright-bdd`. `checkEvidenceMedia` reads the Playwright config at the root, then in each workspace, and runs when `bdd_cmd` names Playwright or the config uses playwright-bdd.

## Decisions

Reading the npm script behind `bdd_cmd` to find its folder was rejected: the workspaces are what the project declares, and a script can call anything.
