# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-176 — A question that blocks nothing says so

The system SHALL treat an open question of a draft's `questions.md` whose Blocks cell is `none`, `nothing`, `ninguno`, `ninguna`, `nada`, `n/a` or a dash as a warning, `D7_question_blocks_nothing`, that does not keep the draft from Ready to review, and SHALL still refuse an open question whose Blocks cell is empty with `D7_floating_question`, whose fix names `none`.

#### Scenario: SCN-176a — "none" is a warning

- GIVEN a draft whose questions.md has the open question Q4 "Should it export a backup?" with Blocks "none"
- WHEN the draft is checked
- THEN the only D7 finding is the warning D7_question_blocks_nothing naming Q4

#### Scenario: SCN-176b — An empty Blocks cell is still refused

- GIVEN the same question with an empty Blocks cell
- WHEN the draft is checked
- THEN D7_floating_question is an error whose fix names "none"

<!-- specgate:trace status=Implemented test=tests/unit/draft-checklist.test.ts actor=Developer kind=functional -->
