# Design: rc5-contracts

> Owner: architect — how it is built: modules, mechanisms, channels.

## Modules

- `scripts/lib/contracts.ts` — `apiReferenceProblems(projectDir, { delivering, statusOf })`.
- `scripts/cli/commands/quality/ValidateSpecsCommand.ts` — passes `--delivering` and the matrix status.
- `scripts/lib/story-part.ts` — `contractCitationWarnings(projectDir, changeId)`, called by `change validate`.

## Mechanisms

- AC-1 — a citation that does not resolve is an error only when the requirement is delivered (its trace
  `status=` or its matrix row is Implemented, Verified or Released) or is the one named by `--delivering`;
  otherwise a warning with the same code (`api_contract_missing`, `api_operation_missing`) saying it must
  resolve once delivered. `validate` lists the warnings with its advisories and passes.
- AC-2 — the same function: delivered or being delivered, the finding stays an error and `validate` fails.
  The harness gate (`validate --strict --delivering`) and the in-flight view of `check`, `status` and the
  studio run the same `validate`, so they follow it.
- AC-3 — `change validate` reads the sub-change's `story.json`, the workspace's roles and the story's map of
  criteria (`## Repositories`); for a member that is not `contracts` and shares a criterion with the
  contracts member, each requirement of the delta with neither `depends=<contracts>:REQ-NNN` nor `api=` is
  a warning `layer_no_contract_cited`. A story that maps no criteria shares them all.

## Decisions

- Warnings, not errors, for AC-1 and AC-3: a draft is written before its agreement, and a requirement may
  need no agreement at all.
