# Design: show-approval-blockers

`changeShowAnswer` (`scripts/cli/commands/change/ChangeCommand.ts`) adds
`blockers: approvalBlockers(projectDir, id)`, mapped to `code`, `message`,
`fix?`, `target?` — the same function `change approve` refuses with, so the
two cannot disagree. Additive to the JSON: no field changes or goes.
AC-1 → SCN-619a; AC-2 → SCN-619b.
