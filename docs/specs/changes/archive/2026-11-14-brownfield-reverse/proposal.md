# Proposal: brownfield-reverse

## Intent

`specgate adopt` installs the specification files in a repository that has
code, but it writes no requirement: a team with a running system starts from
an empty `spec.md` and has to describe by hand what the code already does.
AIUP's `/reverse-engineer` drafts use cases and an entity model from existing
code, module by module, and its `/spec-review` records today's findings as a
baseline so only new problems fail the build. Specgate has neither, and that
is the first question an enterprise with a legacy system asks.

## Scope

In scope:

- REQ-528: `specgate reverse --modules` lists candidate modules from the
  source tree, without an agent.
- REQ-529: `specgate reverse <module>` has the configured agent draft one
  module's requirements and scenarios into a change, every requirement
  `Draft`, never into `spec.md`.
- REQ-530: every reversed requirement cites the code it was read from, the
  gate checks the cited files exist, and behaviour the agent judges wrong
  becomes a question, not a requirement.
- REQ-531: `specgate check --baseline` records the current findings; after
  that, only findings absent from the baseline fail the gate.

Out of scope:

- Reversing a whole repository in one run: one module per run, reviewed
  before the next.
- Generating tests for the reversed requirements: that is the harness, once a
  person has moved them past `Draft`.

## Approach

`reverse --modules` reads the source tree the way `adopt` detects the stack
(packages, `src/*` folders, Maven/Gradle modules, workspaces) and answers each
candidate with its path and file count. `reverse <module>` reuses the agent
plumbing of `propose --from-brief --agent`: the agent runs in the project and
every write outside its answer file is undone. It answers JSON (requirements,
scenarios, `source`, `suspect`), and Specgate writes the delta into
`docs/specs/changes/reverse-<module>/` from it — so `Draft`, `source=` and
suspects-as-questions hold whatever the agent does. `source_missing` is a
warning: a refactor that moves a file is not a broken contract. The baseline is a JSON file of finding
fingerprints (code, file, requirement id) committed beside the matrix.
