# Proposal: studio-phase3-json

## Intent

specgate-studio's phase 3 — the Traceability, Report and Settings views —
talks to specgate only through `--json` and `@rsaglobaltech/specgate/api`; it
never parses prose or Markdown. What those answers say today is not enough:

- `matrix --json` and `matrix(dir)` give a row count, not the rows, and not
  which link a row is missing or which question it waits for.
- `report` and `harness report` cannot be narrowed to one capability, and
  `status --json` does not say a requirement's capability.
- A failed `check --json` gives only the failing stage's code: not the stages
  that passed before it, not validate's own findings.
- Nothing keeps the last gate result, so the studio would have to run the
  whole gate to show it.
- `config` does not say which file a setting is kept in, has no catalog of its
  keys, and cannot write agent profiles, quality checks or ALM settings.
- `harness report` gives an estimated cost only, even when the agent reported
  the tokens it used.
- `report --format json` has no line coverage of the project, only the
  harness's diff coverage per requirement, and the API has no `report`.

## Scope

In scope:

- `matrix.scenarios`, one row per scenario with its links, gaps and waiting
  question (REQ-498).
- `coverage.lines` in `report --format json` and the API's new `report(dir)`,
  read from the coverage report the project's tool writes, never 0 for
  nothing measured (REQ-499).
- `capability` in `status --json`; `--capability <name>` on `report` and
  `harness report` (REQ-500 … REQ-502).
- `stages` in every `check --json` answer; the last result kept in the git
  folder and read back with `check --last --json` and `lastCheck(dir)`
  (REQ-503, REQ-504).
- `files` in `config` answers, `config keys --json`, and `config set` for
  `profiles.<name>.<field>`, `agent_profile`, `quality`, `diff_coverage`, `mutation_score`,
  `checks.<name>.<field>`, `alm.<key>` and `alm.pr.<key>` (REQ-505 … REQ-508).
- Tokens recorded per agent step in the run ledger, and the measured cost per
  profile beside the estimate (REQ-509).

Out of scope:

- The studio's own views.
- Removing a profile, a check or an ALM key with `config` (`config unset`).
- Pricing tokens by model: prices are the profile's.
- Running the coverage tool: `report` reads the report the tests left.

## Approach

Each answer is extended, never reshaped: `matrix.rows` stays the count and the
rows go under `matrix.scenarios`; a failed `check --json` keeps `check: null`
and gains a top-level `stages`; `config` answers gain `files` beside `config`.
The capability is the folder of the capability spec, or of the open change's
delta, that states the requirement — the name `propose --capability` already
uses — so the flag is `--capability`, not `--module`. The last check lives where
the pet's state does (REQ-256), so a check still leaves `git status` clean.
`config set` edits YAML line by line, keeping comments and every other key,
and checks the result with the file's own reader before writing it.
