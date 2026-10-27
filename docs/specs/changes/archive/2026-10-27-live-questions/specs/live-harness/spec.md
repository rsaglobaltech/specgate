# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-203 — Every open question, answered from the live view

The system SHALL carry in the live model every open question that `specgate questions` lists and every requirement in Needs Clarification with no question, and the live view SHALL list them under "Open questions" — those the agent asked stay under Needs attention — each question with the form that answers it and marks it reviewed, and each waiting requirement with the command that asks.

#### Scenario: SCN-203a — Open questions in the live view

- GIVEN draft-examen's Q6 is open and REQ-031 is Needs Clarification with no question
- WHEN the live model is read and the page served
- THEN the model holds Q6 with its change, text and blocks, and REQ-031 as waiting, and the page lists them under Open questions with an answer form for Q6

<!-- specgate:trace status=Implemented test=tests/unit/studio-answer.test.ts actor=Developer kind=functional -->
