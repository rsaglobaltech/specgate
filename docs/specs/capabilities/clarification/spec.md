# Clarification

## Requirements

### Requirement: REQ-187 — Everything waiting for an answer, in one list

The system SHALL list with `specgate questions` every open question of every open change's `questions.md` and of the project's `docs/specs/questions.md`, with its change, its text and the requirements it blocks, followed by every requirement in `Needs Clarification` that no open question names; `--json` SHALL give the same as one document, and with nothing open it SHALL say so and exit 0.

#### Scenario: SCN-187a — Open questions from every change, answered ones left out

- GIVEN change draft-examen has Q1 answered and Q6 open blocking REQ-049, and change draft-diario has Q2 open blocking nothing
- WHEN `specgate questions` runs
- THEN it lists Q6 of draft-examen with REQ-049 and Q2 of draft-diario, and not Q1

#### Scenario: SCN-187b — A requirement waiting with no question is listed too

- GIVEN REQ-030 is in `Needs Clarification` and no open question names it
- WHEN `specgate questions` runs
- THEN it lists REQ-030 under the requirements waiting without a question

#### Scenario: SCN-187c — Nothing open

- GIVEN no change has an open question and no requirement is in `Needs Clarification`
- WHEN `specgate questions` runs
- THEN it says nothing waits for an answer and exits 0

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-187.feature kind=functional status=Implemented test=tests/unit/clarification-cli.test.ts -->

### Requirement: REQ-188 — Answering a question writes the answer and what it decides

The system SHALL, with `specgate answer <Q> "<text>"` (and `--change <id>` when more than one change has that question), write the text into the question's Answer cell and set its Status to answered, add to the change's `assumptions.md` an assumption with the answer, the requirements the question blocks under "Used in", the question as its reason and the status `to review`, and list the requirements to revise; the draft checklist SHALL not pass while an assumption is `to review`; `specgate answer <Q> --reviewed` SHALL set it to `decided`; an answer that puts the decision off SHALL be refused.

#### Scenario: SCN-188a — The answer, its assumption and the requirements to revise

- GIVEN draft-examen's Q6 is open, blocks REQ-049 and the last assumption is A27
- WHEN `specgate answer Q6 "Königsbrücker Straße from the footbridge"` runs
- THEN Q6's Answer holds the text and its Status is answered, assumptions.md gains A28 with the text, REQ-049 under "Used in", "Q6" as its reason and the status `to review`, and REQ-049 is listed to revise

#### Scenario: SCN-188b — A draft waits until the answer is in its spec

- GIVEN A28 is `to review`
- WHEN the draft checklist runs
- THEN it fails, naming A28 and the command that marks it reviewed; and after `specgate answer Q6 --reviewed` it no longer fails for it

#### Scenario: SCN-188c — Ambiguous or deferred answers are refused

- GIVEN two changes have a question Q2
- WHEN `specgate answer Q2 "yes"` runs without `--change`, or `specgate answer Q6 "TBD"` runs
- THEN the first is refused naming both changes, the second is refused as an answer that decides nothing, and nothing is written

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-188.feature kind=functional status=Implemented test=tests/unit/clarification-cli.test.ts -->

### Requirement: REQ-189 — The agent can ask instead of guessing

The system SHALL, with `specgate ask <REQ> "<question>"`, add the question to the open change that defines the requirement (or to `docs/specs/questions.md` when a capability does) as an open row that blocks it, and set the requirement to `Needs Clarification`; inside the harness, where the agent may not edit the specification, `ask` SHALL only record the question as an event, and the harness SHALL end that attempt as `needs clarification`, not as a failure, without spending the remaining attempts, then write the question and the status into the project and commit them; and the live view SHALL show it under "Needs attention" with the question and the command that answers it.

#### Scenario: SCN-189a — Asking records the question and the requirement waits

- GIVEN REQ-049 is defined by change draft-examen, whose last question is Q7
- WHEN `specgate ask REQ-049 "Which photo of Königsbrücker Straße?"` runs
- THEN draft-examen's questions.md gains Q8 with that text blocking REQ-049, and REQ-049 is `Needs Clarification`

#### Scenario: SCN-189b — The harness stops the requirement without spending its attempts

- GIVEN an agent that runs `specgate ask` for its requirement during attempt 1 of 3
- WHEN the attempt ends
- THEN the requirement's result is `needs clarification` with the question, no second attempt runs, the events record the question, and the project has a commit adding it to questions.md with the requirement `Needs Clarification`

#### Scenario: SCN-189c — The live view shows the question

- GIVEN REQ-049's last attempt ended asking a question
- WHEN the live model is read
- THEN REQ-049 is in "Needs attention" with its question and `specgate answer Q8 "…"`

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-189.feature kind=functional status=Implemented test=tests/unit/clarification-cli.test.ts -->

### Requirement: REQ-481 — Each question says where it was asked

The system SHALL say, for every question that `specgate questions --json` and the API's `questions(dir)` answer, where it was asked, as `asked`: `build` when `specgate ask` added it while a requirement was being built, `brief` when its change was opened from a brief and its text is one of the questions of the brief's module, and `draft` otherwise; `specgate ask` SHALL record `build` in the question's row so that it is read back.

#### Scenario: SCN-481a — A brief's question, a draft's and the agent's

- GIVEN the draft `draft-orders`, opened from the brief, whose Q1 is the brief's question "From what amount is shipping free?" and whose Q2 the draft added
- WHEN the agent building REQ-001 runs `specgate ask REQ-001 "Is the invoice sent by email?"` and a tool runs `specgate questions --json`
- THEN Q1 has `asked` `brief`, Q2 has `asked` `draft`, the agent's Q3 has `asked` `build`, and the API's `questions(dir)` gives the same

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-481.feature kind=functional status=Implemented -->

### Requirement: REQ-482 — An answered question waits to be confirmed in sight

The system SHALL list, in `specgate questions --json` and the API's `questions(dir)`, as `answered`, every question that has an answer that `specgate answer <Q> --reviewed` has not confirmed, each with its answer and the requirements it blocks, and SHALL drop it from `answered` once it is confirmed.

#### Scenario: SCN-482a — Q1 answered "50 €", then confirmed

- GIVEN the draft `draft-orders` whose Q1 blocks REQ-002
- WHEN a tool runs `specgate answer Q1 "50 €" --change draft-orders`, then `specgate questions --json`, then `specgate answer Q1 --reviewed --change draft-orders` and `specgate questions --json` again
- THEN the first answer lists Q1 in `answered` with `answer` "50 €" and blocks REQ-002, and not in `open`; the second lists Q1 in neither

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-482.feature kind=functional status=Implemented -->

### Requirement: REQ-479 — Each open question carries its options

The system SHALL include, for every open question that `specgate questions --json` and the API's `questions(dir)` answer, the options its author listed in the question's "Options seen" cell, as a list — empty when it lists none — so that a tool shows them without reading `questions.md` itself.

#### Scenario: SCN-479a — Q2 and its two options

- GIVEN the draft `draft-orders`, whose Q2 lists "before shipping; within 24 h" as the options seen
- WHEN a tool runs `specgate questions --json`
- THEN Q2 in its answer has `options` `["before shipping", "within 24 h"]`, and the API's `questions(dir)` gives the same

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-479.feature kind=functional status=Implemented -->

### Requirement: REQ-480 — A threshold with no value is flagged

The system SHALL flag, with `B6_unmeasured`, a rule of the brief that names a threshold without its value — "some amount", "a certain number", "cierto importe", "einen bestimmten Betrag" — as it flags a quantity promised with no number.

#### Scenario: SCN-480a — Free shipping above some amount

- GIVEN a brief whose module rule says "Shipping is free above some amount."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN the check reports `B6_unmeasured` for that rule, and none for "Shipping is free above 50 €."

<!-- specgate:trace actor=Developer feature=features/clarification/REQ-480.feature kind=functional status=Implemented -->
