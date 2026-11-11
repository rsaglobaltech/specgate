# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-484 — A draft's review notes, as JSON

The system SHALL give, in `specgate change show <id> --json` and in the API's `change(dir, id)`, the change's review notes under `change.review`: for each request of its `review.md`, its id (`N1`, `N2`… in the file's order), its date, its text, the requirement it is about or null, its state — `open` or `addressed` — and the file and line it is written at; and, once addressed, the date it was addressed and what changed: for each requirement the redraft changed, its delta file, its line, and its text before and after.

#### Scenario: SCN-484a — One note addressed, one open

- GIVEN `draft-orders` whose review.md has N1 on REQ-001, addressed by a redraft that changed REQ-001's text, and N2 on no requirement, open
- WHEN a tool runs `specgate change show draft-orders --json` and calls `change(dir, "draft-orders")`
- THEN both answers are equal; N1 is `addressed`, with REQ-001's delta file, its line, and its text before and after the redraft; N2 is `open` with a null requirement

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-485 — Drafting again hands the open notes to the agent

The system SHALL, when `specgate propose --from-brief <module> --agent <cmd>` drafts again a draft with open review notes, put in the agent's prompt each open note — its id, its requirement and its text — and no addressed one; SHALL say under `draft.notes` of its JSON which notes it gave, which it marked addressed and which are still open; and SHALL mark addressed, with the date and the text before and after, each note it gave whose requirement the agent changed — or, for a note on no requirement, whose draft the agent changed.

#### Scenario: SCN-485a — Two open notes, the agent changes one requirement

- GIVEN `draft-orders` with N1 on REQ-001 addressed, and N2 on REQ-001 and N3 on REQ-002 open
- WHEN `specgate propose --from-brief orders --agent <cmd> --json` runs and the agent changes REQ-001 only
- THEN the agent's prompt carries N2 and N3 and not N1; `draft.notes` gives N2 and N3 as given, N2 as addressed and N3 as open; and review.md marks N2 addressed with REQ-001 before and after

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
