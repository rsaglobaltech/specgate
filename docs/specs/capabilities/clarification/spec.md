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
