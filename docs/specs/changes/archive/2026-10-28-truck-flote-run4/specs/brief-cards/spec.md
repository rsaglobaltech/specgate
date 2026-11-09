# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-257 — The incomplete front matter is explained in a sentence

The system SHALL, when `draft` explains an incomplete front matter, say "The front matter at the top of <brief> is incomplete. These are the four fields that tell Specgate what to draft, and what to check each draft against."

#### Scenario: SCN-257a — forja's front matter, modules empty

- GIVEN forja's front matter with `modules: []`
- WHEN `specgate draft` runs
- THEN it says "These are the four fields that tell Specgate what to draft"

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->
