# Delta — studio

## ADDED Requirements

### Requirement: REQ-204 — Studio is an app you use without the commands

The system SHALL serve at studio's root a page with four sections — Home, Questions, Review and Build — each running a specgate command underneath; SHALL offer a simple mode (the default) and an advanced one that shows each action's command and what is written, and Spanish and English, both remembered in the viewer's browser; and SHALL accept its writes only through POST with the token its own page carries, as REQ-201.

#### Scenario: SCN-204a — The app and its sections

- GIVEN studio is running
- WHEN its root is opened
- THEN the page has Home, Questions, Review and Build, a simple/advanced switch and a Spanish/English switch, and carries its token

#### Scenario: SCN-204b — Writes need the token

- GIVEN studio is running
- WHEN an app action is posted without the page's token
- THEN it is refused with 403

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->

### Requirement: REQ-205 — Home says what to do next

The system SHALL give Home the project's counts — requirements built of the total, questions waiting, drafts to review, whether the gate passes — the progress of each module, and one next action, the first of: answer the questions waiting, review the drafts not approved, build the requirements ready, or nothing left.

#### Scenario: SCN-205a — Questions come first

- GIVEN two open questions, an unapproved draft and requirements ready to build
- WHEN Home is read
- THEN its next action is to answer the questions, naming how many

#### Scenario: SCN-205b — Then review, then build, then done

- GIVEN no open question and an unapproved draft, then no draft, then nothing left to build
- WHEN Home is read each time
- THEN the next action is review the draft, then build, then nothing left

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->

### Requirement: REQ-206 — A draft is approved by a person

The system SHALL, with `specgate change approve <id>`, record in the change's change.yaml that a person approved it and when, refusing while the draft checklist has errors or a question it holds is open, and naming them; the record SHALL survive later rewrites of change.yaml; and Review SHALL list each open change not approved with its requirements as statement and Given/When/Then, the checklist as plain checks, and Approve enabled only when nothing blocks it.

#### Scenario: SCN-206a — Approving a ready draft

- GIVEN draft-garaje passes its checklist and has no open question
- WHEN `specgate change approve draft-garaje` runs
- THEN change.yaml says approved with today's date, and the draft leaves Review

#### Scenario: SCN-206b — A draft with an open question is not approved

- GIVEN draft-garaje has an open question
- WHEN it is approved
- THEN it is refused naming the question, and change.yaml is unchanged

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->

### Requirement: REQ-207 — Asking a draft for a change in your own words

The system SHALL, with `specgate change note <id> "<text>" [--req <REQ>]`, append the request with its date and requirement to the change's review.md, and Review SHALL show a draft's open notes beside it and offer to write one per requirement.

#### Scenario: SCN-207a — A note on a requirement

- GIVEN draft-garaje holds REQ-212
- WHEN `specgate change note draft-garaje "Mejor 2 horas antes" --req REQ-212` runs
- THEN review.md holds the note with REQ-212 and the date, and Review lists it under the draft

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->

### Requirement: REQ-208 — Build lists what is ready and starts it

The system SHALL list under Build the requirements left to build that wait for no answer and whose open change, if any, is approved, with an estimate from earlier runs of how long and, when sessions reported it, how much; SHALL start `specgate harness run --chain` on the ones chosen in the background and answer at once; SHALL refuse to start without a configured agent or while a run holds the working copy; and SHALL show the run in progress as its steps in plain words.

#### Scenario: SCN-208a — What is ready, and what is not

- GIVEN REQ-210 in an approved change, REQ-211 waiting for an answer, and REQ-213 in a change not approved
- WHEN Build is read
- THEN only REQ-210 is ready

#### Scenario: SCN-208b — Starting a build

- GIVEN a configured agent and REQ-210 ready
- WHEN Build is started for REQ-210
- THEN it answers at once and a harness run for REQ-210 is under way

#### Scenario: SCN-208c — No agent, no build

- GIVEN no agent is configured
- WHEN Build is started
- THEN it is refused, saying how to configure one

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->

### Requirement: REQ-209 — Stopping a run after the requirement in progress

The system SHALL let a person ask a harness run to stop once the requirement in progress ends — from Build, or by a stop file beside the events — so the run starts no other requirement, reports the rest as not attempted because a stop was asked, and removes the request.

#### Scenario: SCN-209a — The run stops between requirements

- GIVEN a chain of REQ-001 and REQ-002, and a stop asked while REQ-001 runs
- WHEN REQ-001 ends
- THEN REQ-002 is not attempted, the reason says a stop was asked, and the stop request is gone

<!-- specgate:trace status=Implemented test=tests/unit/harness-run.test.ts actor=Developer kind=functional -->

### Requirement: REQ-210 — Questions in the app

The system SHALL list under Questions every open question with where it comes from (the agent, a draft, the project), what it blocks and the options it lists, with the form that answers it, and the answers whose assumption is still to review, with the action that marks them reviewed.

#### Scenario: SCN-210a — Open and to review

- GIVEN Q6 is open with options listed and Q1 is answered with its assumption to review
- WHEN Questions is read
- THEN Q6 is listed with its options and form, and Q1 under the answers to confirm

<!-- specgate:trace status=Implemented test=tests/unit/studio-app.test.ts actor=Developer kind=functional -->
