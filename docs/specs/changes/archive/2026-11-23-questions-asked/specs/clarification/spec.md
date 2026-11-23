# Delta — clarification

## ADDED Requirements

### Requirement: REQ-481 — Each question says where it was asked

The system SHALL say, for every question that `specgate questions --json` and the API's `questions(dir)` answer, where it was asked, as `asked`: `build` when `specgate ask` added it while a requirement was being built, `brief` when its change was opened from a brief and its text is one of the questions of the brief's module, and `draft` otherwise; `specgate ask` SHALL record `build` in the question's row so that it is read back.

#### Scenario: SCN-481a — A brief's question, a draft's and the agent's

- GIVEN the draft `draft-orders`, opened from the brief, whose Q1 is the brief's question "From what amount is shipping free?" and whose Q2 the draft added
- WHEN the agent building REQ-001 runs `specgate ask REQ-001 "Is the invoice sent by email?"` and a tool runs `specgate questions --json`
- THEN Q1 has `asked` `brief`, Q2 has `asked` `draft`, the agent's Q3 has `asked` `build`, and the API's `questions(dir)` gives the same

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-482 — An answered question waits to be confirmed in sight

The system SHALL list, in `specgate questions --json` and the API's `questions(dir)`, as `answered`, every question that has an answer that `specgate answer <Q> --reviewed` has not confirmed, each with its answer and the requirements it blocks, and SHALL drop it from `answered` once it is confirmed.

#### Scenario: SCN-482a — Q1 answered "50 €", then confirmed

- GIVEN the draft `draft-orders` whose Q1 blocks REQ-002
- WHEN a tool runs `specgate answer Q1 "50 €" --change draft-orders`, then `specgate questions --json`, then `specgate answer Q1 --reviewed --change draft-orders` and `specgate questions --json` again
- THEN the first answer lists Q1 in `answered` with `answer` "50 €" and blocks REQ-002, and not in `open`; the second lists Q1 in neither

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
