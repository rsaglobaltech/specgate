# Design: adopt-no-code

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/cli/commands/project/AdoptCommand.ts`, `templates/adopt/spec.md.tpl`,
`templates/adopt/traceability.md.tpl`, `templates/adopt/first.feature.tpl`
(new), `scripts/cli/commands/project/OnboardCommand.ts` (`countFiles`
exported), `scripts/cli/commands/spec/StatusCommand.ts`.

## Mechanisms

- AC-1 — no code is: no build manifest (`detectStack` answers `none`) and no
  source file (`countFiles` is 0). A folder of sources with no manifest is
  code. `adopt` prints "No code here yet: set up as a new project", and the
  header of `AGENTS.md` says `new project`.
- AC-2 — `API_STYLE` defaults to `TBD` with no code and to `as built` with
  code, in `AGENTS.md` and in `spec.md`; `--var API_STYLE=…` still decides.
  The `REST with DTO boundaries` default is gone: it overrode the `as built`
  the contract already meant to say.
- AC-3 — the two wordings are one table (`BASELINE`) of template variables.
  With no code: REQ-001 "The project builds and its tests run", its use case
  "Build and test the project", and `first.feature.tpl`. The scenario stays at
  `features/adoption/baseline.feature`, the path `validate`, `status` and the
  harness know the baseline by. `status` gives its reason from the use case's
  name.
- AC-4 — with code, every generated file is as before, but for `API: as built`.

## Not in this change

`specgate init --yes` in an empty folder scaffolds a Java and Spring project
in a subfolder; `onboard` in an empty folder points to `adopt`. Both are on
the same path and are not touched here.
