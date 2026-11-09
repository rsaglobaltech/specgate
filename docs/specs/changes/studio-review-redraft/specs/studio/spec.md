# Delta — studio-review-redraft

## ADDED Requirements

### Requirement: REQ-449 — A requested change, said for what it is

The system SHALL, when a change is asked for a draft's requirement, say that it was noted in the change's review.md and that the draft changes only when it is drafted again with its notes; and SHALL show each note as open or addressed, with the date it was addressed.

#### Scenario: SCN-449a — Asked, not yet done

- GIVEN the draft `draft-orders` to review, with REQ-001
- WHEN a change is asked for REQ-001 with "Cancel up to 24 h before shipping"
- THEN the notice says it was noted in review.md and that the draft changes when it is drafted again, and the note is listed as open under REQ-001

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-450 — A draft drafted again with the changes asked

The system SHALL, when a draft with open notes is drafted again — from the studio or with `specgate propose --from-brief <module>` — put each open note, with its requirement, in the draft's DRAFTING.md under "Changes the reviewer asked for", telling the agent to edit the draft rather than start over; SHALL mark addressed the notes the run was given once the draft is checked again; and SHALL show, for each requirement a note named, its text before and after the run.

#### Scenario: SCN-450a — Drafted again with one note

- GIVEN `draft-orders` with an open note on REQ-001, "Cancel up to 24 h before shipping"
- WHEN it is drafted again from the studio
- THEN DRAFTING.md lists that note under REQ-001, the note is addressed once the draft is checked, and the studio shows REQ-001's text before and after

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-451 — Approving with requested changes still open

The system SHALL, when a draft is approved while notes are open, say how many and which before approving, and approve it only once the person confirms.

#### Scenario: SCN-451a — One note still open

- GIVEN `draft-orders` ready to approve, with one open note on REQ-001
- WHEN Approve the draft is pressed
- THEN the studio says one requested change is still open, on REQ-001, and approves only after the person confirms

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
