# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-664 — A plan applied hunk by hunk

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-664.feature actor=Developer kind=functional -->

The system SHALL, on `specgate agent apply <plan-id> --hunk <path>#<n>…`, write only the hunks named — numbered from 1 in the order of each file's diff, a new or removed file being its one hunk —, each file from what it holds now with those hunks applied and the others left out, a file whose every hunk is named written byte for byte as the plan holds it, and a file with none untouched; it SHALL refuse with `hunk_not_found` a hunk the plan does not have, writing nothing, and answer under `applied.hunks` the hunks written.

> Studio (agent-panel, 2026-11-22): the agent's diff accepted or rejected hunk by hunk, as in an IDE.

#### Scenario: SCN-664a — The first of two hunks applied

- GIVEN a plan that changes spec.md's first line and adds a line at its end
- WHEN the Developer runs `specgate agent apply <id> --hunk spec.md#1`
- THEN spec.md's first line is changed, its last line is not added, and `applied.hunks` is `["spec.md#1"]`

#### Scenario: SCN-664b — A hunk the plan does not have

- GIVEN the same plan
- WHEN the Developer runs `specgate agent apply <id> --hunk spec.md#3`
- THEN it is refused with `hunk_not_found` and nothing is written

### Requirement: REQ-665 — An applied plan taken back

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-665.feature actor=Developer kind=functional -->

The system SHALL keep, when a plan is applied, what each file it wrote held before, and SHALL, on `specgate agent revert <plan-id>`, put every file back as it was — a file the plan made removed, one it removed made again — when each still holds what the plan wrote; it SHALL refuse with `revert_stale`, writing nothing, when one changed since, and with `revert_not_found` when the plan was never applied here.

#### Scenario: SCN-665a — Applied, then taken back

- GIVEN a plan applied to spec.md
- WHEN the Developer runs `specgate agent revert <id>`
- THEN spec.md is as before the plan, and `reverted.files` names spec.md

#### Scenario: SCN-665b — Changed since it was applied

- GIVEN a plan applied to spec.md, then spec.md edited
- WHEN the Developer runs `specgate agent revert <id>`
- THEN it is refused with `revert_stale` naming spec.md, and spec.md keeps the edit
