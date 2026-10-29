# Delta — workspace

## ADDED Requirements

### Requirement: REQ-320 — Each repository's harness, seen from the workspace

The system SHALL show, in the workspace's live model, one panel per repository of the workspace: its harness queue, the requirement in flight — the most recently updated one still running — with its attempt, the gate step running and since when, where it runs, and its agent's last step; and no requirement in flight for a repository whose harness is idle.

#### Scenario: SCN-320a — Tracking is on a quality check, fleet is idle

- GIVEN a workspace of fleet and tracking, and tracking's harness on REQ-005 with the gate step "quality: semgrep" started in Docker after its agent edited TrackingController.java
- WHEN the developer runs `specgate workspace live --json`
- THEN tracking's panel shows REQ-005 in flight on "quality: semgrep" in docker with the agent's last step an edit of TrackingController.java, and fleet's panel shows nothing in flight

<!-- specgate:trace status=Implemented test=tests/unit/workspace-live.test.ts actor=Developer kind=functional -->

### Requirement: REQ-321 — A story's parts, building and blocked

The system SHALL show, for each story of the workspace, its sub-change in every repository as open, building — a requirement of its delta has harness events — archived or missing, and SHALL name, for a sub-change, each `repo:REQ-NNN` that a requirement of its delta depends on and that is not delivered in that repository.

#### Scenario: SCN-321a — Tracking builds, and waits on fleet

- GIVEN the story follow-shipment across fleet and tracking, whose tracking delta adds REQ-005 with `depends=fleet:REQ-000`, fleet's REQ-000 still Draft, and harness events for REQ-005
- WHEN the developer runs `specgate workspace live --json`
- THEN follow-shipment's tracking part is building and blocked by fleet:REQ-000, and its fleet part is open

<!-- specgate:trace status=Implemented test=tests/unit/workspace-live.test.ts actor=Developer kind=functional -->

### Requirement: REQ-322 — What each repository and each story has cost

The system SHALL show, per repository, the money its agents reported and the minutes its harness ledger recorded, and per story the same sums over the requirements of its sub-changes.

#### Scenario: SCN-322a — Tracking's REQ-005 cost 0.42 and 2 minutes

- GIVEN tracking's harness ledger records REQ-005 for 120000 ms and its events report a cost of 0.42
- WHEN the developer runs `specgate workspace live --json`
- THEN tracking's cost is 0.42 and 2 minutes, and the story follow-shipment's cost is 0.42 and 2 minutes

<!-- specgate:trace status=Implemented test=tests/unit/workspace-live.test.ts actor=Developer kind=functional -->

### Requirement: REQ-323 — The workspace's live view

The system SHALL serve, when `specgate studio` runs in a workspace repository, the workspace's live model at `/live.json`, its changes at `/live/stream` and a page at `/live` with the repositories' panels, the stories and the costs; and `specgate workspace live` SHALL start that studio, or print the model with `--json`.

#### Scenario: SCN-323a — Studio in the workspace repository

- GIVEN a workspace of fleet and tracking
- WHEN the developer starts `specgate studio` in the workspace repository and opens /live.json and /live
- THEN /live.json is the workspace model with both repositories, and /live is the workspace's page

<!-- specgate:trace status=Implemented test=tests/unit/workspace-live.test.ts actor=Developer kind=functional -->

### Requirement: REQ-324 — Build a story in every repository at once

The system SHALL start, with `specgate workspace harness run --story <id>`, one harness per repository holding an open sub-change of the story, for that sub-change's requirements, all at once and each its own process, passing on the arguments after `--`; and SHALL start none when a repository's base already fails the gate on requirements outside its part, naming the repository.

#### Scenario: SCN-324a — A dry run names each repository's harness

- GIVEN the story follow-shipment with an open sub-change in fleet adding REQ-003 and in tracking adding REQ-005
- WHEN the developer runs `specgate workspace harness run --story follow-shipment --dry-run`
- THEN it names a harness for fleet on REQ-003 and one for tracking on REQ-005, and starts none

#### Scenario: SCN-324b — One red base, no harness

- GIVEN the same story, and fleet's REQ-000 Implemented with no test
- WHEN the developer runs `specgate workspace harness run --story follow-shipment`
- THEN it exits non-zero naming fleet, and no harness has started in either repository

<!-- specgate:trace status=Implemented test=tests/unit/workspace-live.test.ts actor=Developer kind=functional -->
