# Delta — workspace

## ADDED Requirements

### Requirement: REQ-566 — The workspace's Live is the studio's

The system SHALL serve, in the studio of a workspace repository, `/live` as the studio app opened on Live, which shows each repository's harness — what it builds, its queue, what passed and failed, what it cost — and each story's parts and what they wait on, each repository linking to `/live/repo/<name>/`; and SHALL serve `/live/repo/<name>/` as the studio app's Live on that member's data, read only, naming the member, its role and the way back; `/live.json`, `/live/stream` and the member's data SHALL answer as before.

#### Scenario: SCN-566a — The workspace's Live in the studio

- GIVEN a workspace where tracking builds REQ-005 at its second attempt and fleet's folder is missing, and a story whose fleet part waits on tracking:REQ-005
- WHEN a lead opens the studio's Live in the workspace repository
- THEN tracking shows REQ-005, its attempt, phase and cost, with a link to /live/repo/tracking/; fleet says its folder is missing; the story's fleet part says it waits on tracking:REQ-005

<!-- specgate:trace status=Implemented feature=features/workspace/REQ-566.feature actor=Lead kind=functional -->
