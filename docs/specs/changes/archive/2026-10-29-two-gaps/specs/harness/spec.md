# Delta — harness

## ADDED Requirements

### Requirement: REQ-300 — A person classifies a requirement's gap

The system SHALL record `specgate harness report --classify REQ-NNN --gap spec-impl|intent-spec --reason "<text>"` as one line of `.harness/gaps.jsonl`, with the time it was made; SHALL refuse a classification without a reason or with another gap; and SHALL count, for a requirement classified more than once, the latest classification.

#### Scenario: SCN-300a — Classifying a requirement

- GIVEN a project whose ledger records REQ-002
- WHEN the person runs `harness report --classify REQ-002 --gap intent-spec --reason "the brief never said a truck can carry two drivers"`
- THEN `.harness/gaps.jsonl` holds that classification and the report counts REQ-002 as intent → spec, marked by a person

#### Scenario: SCN-300b — A classification without a reason

- GIVEN the same project
- WHEN the person runs `harness report --classify REQ-002 --gap spec-impl` with no `--reason`
- THEN the command fails naming `--reason`, and nothing is written

<!-- specgate:trace status=Implemented test=tests/unit/harness-gaps.test.ts actor=Developer kind=functional -->

### Requirement: REQ-301 — Specgate suggests the gap from what it recorded

The system SHALL suggest, for a requirement no person classified, *spec → implementation* when an attempt the gate rejected was followed by a passing attempt, naming the gate stage that rejected it (a quality check by its name), and *intent → spec* when the requirement changed after review — a question that blocked it was answered, a review note names it, a change modifies it, or an attempt ended because the gate failed on the specification; intent → spec SHALL win when both apply, and a person's classification SHALL win over any suggestion. The ledger SHALL record the gate stage of each rejected attempt.

#### Scenario: SCN-301a — A rejection the agent fixed

- GIVEN REQ-002's attempt 1 was rejected at `quality check: pmd` and attempt 2 passed
- WHEN the report is read
- THEN REQ-002 is suggested as spec → implementation, caught by `pmd`

#### Scenario: SCN-301b — A requirement changed after review

- GIVEN REQ-010 passed on attempt 1, and the draft's `questions.md` has an answered question that blocks REQ-010
- WHEN the report is read
- THEN REQ-010 is suggested as intent → spec

<!-- specgate:trace status=Implemented test=tests/unit/harness-gaps.test.ts actor=Developer kind=functional -->

### Requirement: REQ-302 — Both gaps, overall and per module

The system SHALL show in `harness report`, and in its `--json` summary as `gaps`, the number and share of requirements with each gap among the requirements the ledger records, overall and per module, and how many classifications a person made and how many were suggested.

#### Scenario: SCN-302a — Two modules

- GIVEN four requirements in the ledger, REQ-002 and REQ-003 of `flota` and REQ-012 and REQ-013 of `tracking`; REQ-002 spec → implementation and REQ-012 intent → spec
- WHEN the report is read
- THEN each gap is 1 of 4 (25 %), and `flota` shows 1 spec → implementation of 2 and `tracking` 1 intent → spec of 2

<!-- specgate:trace status=Implemented test=tests/unit/harness-gaps.test.ts actor=Developer kind=functional -->

### Requirement: REQ-303 — What to strengthen

The system SHALL name, under the two gaps, what to strengthen: for spec → implementation the gate stage that caught most of them, and for intent → spec the module with most of them — on a tie, the one whose latest classification or evidence is newest.

#### Scenario: SCN-303a — The check that catches most

- GIVEN three requirements suggested as spec → implementation, two caught by `pmd` and one by `test command`
- WHEN the report is read
- THEN it says to strengthen `pmd`

<!-- specgate:trace status=Implemented test=tests/unit/harness-gaps.test.ts actor=Developer kind=functional -->
