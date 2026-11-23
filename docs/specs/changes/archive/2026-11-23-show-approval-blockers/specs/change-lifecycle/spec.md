# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-619 — `change show --json` says what blocks approval before Approve is pressed

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-619.feature actor=Developer kind=functional -->

The system SHALL answer, in `change show <id> --json`, `change.blockers`: the blockers `change approve <id>` would refuse with as `approve_blocked` — each with its `code`, `message` and, when the rule gives them, its `fix` and `target` — and `[]` when nothing blocks the change; so that a client says what is left before the person presses Approve, and never parses the refusal's prose.

> Studio report (#538): a draft with six `D6_unlisted_value` findings was listed to review with an Approve button; the person pressed it and only then learned, from `approve_blocked`, that it could not be approved.

#### Scenario: SCN-619a — A change approve would refuse

- GIVEN a change whose question Q1 blocks REQ-001, which is not Needs Clarification
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.blockers` lists `D7_floating_question` naming Q1 and REQ-001 with its fix, and every blocker's message is in the message `change approve` refuses with

#### Scenario: SCN-619b — A change nothing blocks

- GIVEN a change `change approve` would accept
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.blockers` is `[]`
