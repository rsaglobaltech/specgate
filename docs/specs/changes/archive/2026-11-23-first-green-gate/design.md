# Design: first-green-gate

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/cli/commands/config/CiToolchain.ts`,
`scripts/cli/commands/quality/ValidateSpecsCommand.ts`,
`scripts/cli/commands/spec/StatusCommand.ts`, `docs/start.md`.

## Mechanisms

- AC-1 — `pythonInstall` reads the repository: `pip install -r` for each of
  `requirements.txt`, `requirements-dev.txt`, `requirements-test.txt`,
  `dev-requirements.txt` and `test-requirements.txt` it has; `pip install -e .`
  when `pyproject.toml` has a `[build-system]`, with the `dev`, `test`,
  `tests` or `testing` extra when declared; `pip install pytest` when the test
  command runs pytest and none of those names it. A `pyproject.toml` with
  `[tool.poetry]`, `[tool.pdm]` or `[tool.uv]` gets a comment naming the tool
  and no command. The lines go into the GitHub and Azure jobs as a step, and
  before the gate in the GitLab and Jenkins container jobs.
- AC-2 — when the scenario check is about to fail for the requirement being
  delivered (`--delivering`, as `apply` runs it), it adds that requirement's
  `requirement_template_obligation` to the same report, text and JSON, unless
  the policy reports or skips the requirements rule. `docs/start.md` step 4
  says to replace the sentence and the placeholders.
- AC-3 — `status`, in text: the baseline of a project adopted with code
  (`features/adoption/baseline.feature`, "Preserve existing behaviour"), while
  pending, is said apart from "To do" — held by the suite, and closed by a test
  that names it and starts the product —, and the count leaves it out. `status --json` is unchanged. The baseline
  of a project adopted with no code (REQ-608) stays a to-do.

## Not in this change

The other findings of the run: `ci status` all green with architecture and
quality not configured, three operating systems by default, the agent set
without asking, no areas found for a Python layout, the files adoption adds.
