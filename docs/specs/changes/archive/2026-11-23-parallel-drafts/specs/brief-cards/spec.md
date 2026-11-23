# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-652 — Two modules drafted at once leave each other's draft alone

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, while `specgate propose --from-brief <module> --agent` runs its agent, mark that the change's agent runs — and when it ended — inside git's own folder, where no status shows it; and SHALL, when it confines an agent to its change, neither keep nor undo what changed in the folder of another change whose agent ran at any time during this one, while still undoing everything else outside the change.

#### Scenario: SCN-652a — draft-b's agent writes while draft-a's runs

- GIVEN a project where draft-b's agent runs, and draft-a's agent writes its own draft, writes on in draft-b's folder and touches draft-c, which no agent drafts
- WHEN draft-a's agent ends
- THEN draft-a's draft is what it wrote, draft-b's files are as last written, draft-c's file is undone, and draft-a's mark says when its agent ran without showing in git's status
