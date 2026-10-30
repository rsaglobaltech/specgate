# Delta — workspace

## ADDED Requirements

### Requirement: REQ-410 — Each repository's live view, from the workspace

The system SHALL serve, in the studio of a workspace repository, `/live/repo/<name>/` as the live view of the member `<name>` — the same page, model and stream its own studio serves for `/live`, `/live.json` and `/live/stream`, read from the member's folder and kept current as its harness writes — with a header naming the member and its role and a link back to the workspace's `/live`; `/live/repo/<name>` SHALL redirect to it.

#### Scenario: SCN-410a — The dispatcher follows tracking

- GIVEN the workspace truck-flote has fleet and tracking, and tracking's harness is on REQ-005, attempt 1, at the quality check semgrep
- WHEN the developer opens `/live/repo/tracking/` in the workspace's studio and reads `live.json` and `live/stream` under it
- THEN the page is the harness live view with the work queue and a link back to `/live`, naming tracking and its role, and the model and the first event of the stream carry REQ-005 in flight at attempt 1

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/workspace/REQ-410.feature test=tests/unit/rc9-live.test.ts -->

### Requirement: REQ-411 — The workspace's live view leads to each repository's

The system SHALL link each repository's panel in the workspace's live view to `/live/repo/<name>/`.

#### Scenario: SCN-411a — A panel opens its repository

- GIVEN the workspace truck-flote has fleet and tracking
- WHEN the developer opens the workspace's `/live`
- THEN the page links to `/live/repo/` followed by each repository's name

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/workspace/REQ-411.feature test=tests/unit/rc9-live.test.ts -->

### Requirement: REQ-412 — A repository the workspace does not have, or cannot find

The system SHALL answer `/live/repo/<name>/` and the routes under it with 404, listing the workspace's repositories, when `<name>` is not one of them, and with 404 saying the folder is missing when the member's folder does not exist.

#### Scenario: SCN-412a — An unknown and a missing repository

- GIVEN the workspace truck-flote has fleet and tracking, and fleet's folder has been removed
- WHEN the developer opens `/live/repo/billing/` and `/live/repo/fleet/live.json`
- THEN the first is 404 naming fleet and tracking, and the second is 404 saying fleet's folder is missing

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/workspace/REQ-412.feature test=tests/unit/rc9-live.test.ts -->
