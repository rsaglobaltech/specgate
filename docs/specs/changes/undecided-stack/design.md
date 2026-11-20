# Design: undecided-stack

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/agents/contract-file.ts` (the facts of the contract's header),
`scripts/cli/commands/project/AdoptCommand.ts`, `templates/base/AGENTS.md.tpl`,
`scripts/lib/config-keys.ts`, `scripts/cli/commands/spec/StatusCommand.ts`,
`scripts/cli/commands/quality/DoctorCommand.ts`.

## Mechanisms

- AC-1 — `detectManifest` answers `TBD` (`UNDECIDED`) for `STACK` and
  `TESTING` when no manifest is found. The "Never" rule of the template names
  `TBD`, `specgate config set stack` and `specgate init --forja`; `adopt`'s
  warning names the same two.
- AC-2 — `stack` and `testing` are catalog keys kept in `AGENTS.md`.
  `setContractFact` rewrites the field inside the `specgate:begin … end`
  block only; `config set` refuses a value with a newline or `·`, the header's
  separator, and refuses a file with no block.
- AC-3 — `undecidedFacts` reads the block's header; `undecided` is true for
  `TBD` and for the `unknown — …` that 1.4 and older wrote. `status` prints a
  line per fact in its text output; `doctor` records a warning per fact.
  `status --json` is unchanged.
- AC-4 — a detected stack is never `TBD`, so nothing is printed.

## Not in this change

Offering forja interactively from `adopt`, and generating into a folder
already adopted: whether forja can is not known (issue #502's open question).
