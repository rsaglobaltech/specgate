# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-259 — The root brief's text goes below the front matter

The system SHALL, on `specgate draft` with or without `--agent`, when `docs/brief.md` lists no modules, its body is still a template's — it asks for the brief to be pasted there — and a `brief.md` at the project's root holds text `docs/brief.md` does not (REQ-251), put the root file's text below the front matter as it is, keep the root file, and say so, before the four fields are explained or the agent proposes them.

#### Scenario: SCN-259a — The client's brief pushed first, forja's template beside it

- GIVEN `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and its "Paste the client's brief here" body
- WHEN `specgate draft` runs
- THEN `docs/brief.md` holds forja's front matter followed by the client's text, `brief.md` is still at the root, and the output says the text was put there

#### Scenario: SCN-259b — A body the person wrote is left alone

- GIVEN `brief.md` at the root, and `docs/brief.md` whose body is a brief the person wrote
- WHEN `specgate draft` runs
- THEN `docs/brief.md` is unchanged

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-260 — The guide is removed once the front matter is complete

The system SHALL remove `docs/specs/BRIEF-SETUP.md`, the guide written for an agent to propose the front matter, once `specgate draft` finds the front matter complete — after `draft --agent` proposes one with no fix left, or on a later `draft` — so the working tree holds nothing the person must commit or delete.

#### Scenario: SCN-260a — The agent's front matter needs no fix

- GIVEN `docs/brief.md` without a front matter, and an agent that writes a complete one
- WHEN `specgate draft --agent` runs
- THEN `docs/specs/BRIEF-SETUP.md` does not exist

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/brief-cards.test.ts -->

### Requirement: REQ-261 — D6 reads a value made of listed parts

The system SHALL count a scenario's quoted value as listed when it is made of parts joined by ` › `, ` — ` or ` · ` — a screen path, a list row — and each part is in the brief, in the specification, or in a row of `assumptions.md` that names the scenario or its requirement.

#### Scenario: SCN-261a — The truck-flote fleet module

- GIVEN scenario values "1234-BCD › Ejes" and "Lucía Martín — E000001234567890", and rows listing "1234-BCD", "Ejes", "Lucía Martín" and "E000001234567890" for their requirements
- WHEN the draft is checked
- THEN neither is a D6 finding, and "1234-BCD › Remolque" still is

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-262 — An answered question its requirement does not reflect is a finding

The system SHALL report, for each question of `questions.md` that has an answer and blocks a requirement still `Needs Clarification`, a finding naming the question and the requirement, whose fix says to fold the answer into the requirement's text and scenarios and drop the status, or to have the agent do it; the draft is not ready to review while one is left.

#### Scenario: SCN-262a — Q5 answered, REQ-010 still blocked

- GIVEN `questions.md` where Q5 blocks REQ-010 and its Answer cell says "Hasta dos conductores por camión", and REQ-010 still `Needs Clarification`
- WHEN the draft is checked
- THEN a finding names Q5 and REQ-010 and says to fold the answer into REQ-010 and drop its status

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/draft-checklist.test.ts -->

### Requirement: REQ-263 — `status` says when the answer is in and the spec is not

The system SHALL, in `specgate status`, list a `Needs Clarification` requirement whose blocking questions are all answered under "Answered — update the spec", naming the question, instead of under "Waiting for an answer".

#### Scenario: SCN-263a — The client answered Q5

- GIVEN REQ-010 `Needs Clarification`, blocked by Q5 only, and Q5 answered in its `questions.md`
- WHEN `specgate status` runs
- THEN REQ-010 is under "Answered — update the spec" with Q5, and not under "Waiting for an answer"

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/done-refuses-undeliverable.test.ts -->
