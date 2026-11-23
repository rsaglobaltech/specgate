# Design: status-counts-requirements

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/cli/commands/spec/StatusCommand.ts`.

## Mechanisms

- AC-1, AC-2 — `requirementProgress(items)` groups the queue's rows by
  requirement; a requirement is done when no row of it is in another
  category. The text view's progress line uses it.
- AC-3 — `onePerRequirement` keeps the first row of each requirement in each
  list of the text view.
- AC-4 — `--json` keeps `counts` and `items` per row, as the studio reads
  them.
