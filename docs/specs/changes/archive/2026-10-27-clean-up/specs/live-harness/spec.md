# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-201 — Answering a question from the live view

The system SHALL accept on studio, as its only write, `POST /live/answer` answering a question or marking it reviewed through the same code as `specgate answer`, only with the token this start of studio puts in its page, a JSON body and a loopback or absent origin; SHALL answer any other method than GET or HEAD with 405; and the live view SHALL offer, under each question the agent asked, a form to answer it and then to mark it reviewed.

#### Scenario: SCN-201a — A write needs the token, JSON and a loopback origin

- GIVEN studio's token
- WHEN a write comes without it, with another, as a form, or from another site
- THEN it is refused

#### Scenario: SCN-201b — The live page answers and marks reviewed

- GIVEN draft-examen's Q6 is open and studio is running
- WHEN the page posts an answer to Q6 with its token, then marks it reviewed
- THEN Q6 is answered, A1 is added and then decided, a post without the token is refused with 403 and a PUT with 405

#### Scenario: SCN-201c — The form is under the question

- GIVEN the live page
- WHEN it is served
- THEN Needs attention has the answer form that posts to live/answer with the token, and the token in the page is only hex

<!-- specgate:trace status=Implemented test=tests/unit/studio-answer.test.ts actor=Developer kind=functional -->
