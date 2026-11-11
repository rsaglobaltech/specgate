# Delta — clarification

## ADDED Requirements

### Requirement: REQ-479 — Each open question carries its options

The system SHALL include, for every open question that `specgate questions --json` and the API's `questions(dir)` answer, the options its author listed in the question's "Options seen" cell, as a list — empty when it lists none — so that a tool shows them without reading `questions.md` itself.

#### Scenario: SCN-479a — Q2 and its two options

- GIVEN the draft `draft-orders`, whose Q2 lists "before shipping; within 24 h" as the options seen
- WHEN a tool runs `specgate questions --json`
- THEN Q2 in its answer has `options` `["before shipping", "within 24 h"]`, and the API's `questions(dir)` gives the same

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-480 — A threshold with no value is flagged

The system SHALL flag, with `B6_unmeasured`, a rule of the brief that names a threshold without its value — "some amount", "a certain number", "cierto importe", "einen bestimmten Betrag" — as it flags a quantity promised with no number.

#### Scenario: SCN-480a — Free shipping above some amount

- GIVEN a brief whose module rule says "Shipping is free above some amount."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN the check reports `B6_unmeasured` for that rule, and none for "Shipping is free above 50 €."

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
