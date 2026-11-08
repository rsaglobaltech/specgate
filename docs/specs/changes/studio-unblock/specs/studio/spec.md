# Delta — studio

## MODIFIED Requirements

### Requirement: REQ-206 — A draft is approved by a person

The system SHALL, with `specgate change approve <id>`, record in the change's change.yaml that a person approved it and when, refusing while the draft checklist has errors or a question it holds is open, and naming them; the record SHALL survive later rewrites of change.yaml; and Review SHALL list each open change not approved with its requirements as statement and Given/When/Then, the checklist as plain checks, and Approve enabled only when nothing blocks it. Each blocker SHALL be listed with the action that clears it — answering a question, confirming that the spec says an answer, opening the requirement the checklist names — and a question SHALL be matched by its exact id.

> Amended by studio-unblock: on 2026-11-08 Approve stayed disabled with no way to clear what blocked it, and a blocker naming Q10 hid Q1.

#### Scenario: SCN-206a — Approving a ready draft

- GIVEN draft-garaje passes its checklist and has no open question
- WHEN `specgate change approve draft-garaje` runs
- THEN change.yaml says approved with today's date, and the draft leaves Review

#### Scenario: SCN-206b — A draft with an open question is not approved

- GIVEN draft-garaje has an open question
- WHEN it is approved
- THEN it is refused naming the question, and change.yaml is unchanged

#### Scenario: SCN-206c — Every blocker with its action

- GIVEN draft-garaje with Q1 open and Q10 answered by hand but still blocking REQ-214
- WHEN Review is read
- THEN Approve is disabled, Q1 is listed with "answer" and Q10 with "it is in the spec", each once

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-208 — Build lists what is ready and starts it

The system SHALL list under Build the requirements left to build that wait for no answer and whose open change, if any, is approved, with an estimate from earlier runs of how long and, when sessions reported it, how much; SHALL start `specgate harness run --chain` on the ones chosen in the background and answer at once; SHALL refuse to start without a configured agent or while a run holds the working copy; and SHALL show the run in progress as its steps in plain words. Without a configured agent, Build SHALL offer to choose one (REQ-431) instead of naming a command.

> Amended by studio-unblock: Build said the agent was missing and named `specgate harness init`, which does not write one.

#### Scenario: SCN-208a — What is ready, and what is not

- GIVEN REQ-210 in an approved change, REQ-211 waiting for an answer, and REQ-213 in a change not approved
- WHEN Build is read
- THEN only REQ-210 is ready

#### Scenario: SCN-208b — Starting a build

- GIVEN a configured agent and REQ-210 ready
- WHEN Build is started for REQ-210
- THEN it answers at once and a harness run for REQ-210 is under way

#### Scenario: SCN-208c — No agent, no build

- GIVEN no agent is configured and `claude` is on the PATH
- WHEN Build is read and started
- THEN the start is refused, and Build offers Claude Code as the agent to choose

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-210 — Questions in the app

The system SHALL list under Questions every open question with where it comes from (the agent, a draft, the project), what it blocks and the options it lists, with the form that answers it, and the answers still to confirm in the spec, one per question, with the action that confirms them. Answering SHALL write the answer into `questions.md` whatever columns its table has, keeping its line endings, and SHALL fail, saying why, when it writes nothing; answering again SHALL replace the answer, not add a second one to confirm. Confirming SHALL mark the question reviewed and lift `Needs Clarification` from the requirements it blocks, whether the answer came from the studio or was written by hand.

> Amended by studio-unblock: on 2026-11-08 an answer was reported saved and never written, each click added a row to confirm, and answers written by hand could not be confirmed.

#### Scenario: SCN-210a — Open and to review

- GIVEN Q6 is open with options listed and Q1 is answered with its assumption to review
- WHEN Questions is read
- THEN Q6 is listed with its options and form, and Q1 under the answers to confirm

#### Scenario: SCN-210b — An answer into a table without an Answer column

- GIVEN `questions.md` with the columns `# | Question | Blocks | Options seen`, CRLF line endings, and Q1 open
- WHEN Q1 is answered twice in the studio
- THEN `questions.md` has `Answer` and `Status` columns, Q1's latest answer, CRLF endings, and Q1 is listed once to confirm

#### Scenario: SCN-210c — Confirming an answer given by hand

- GIVEN Q2 answered by hand in `questions.md` and REQ-215 marked `Needs Clarification` for it
- WHEN Q2 is confirmed in the studio
- THEN Q2 is reviewed, REQ-215 no longer says `Needs Clarification`, and Q2 no longer blocks approval

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

## ADDED Requirements

### Requirement: REQ-429 — One way to write and read an answer

The drafting guide SHALL tell the agent to write `questions.md` with the columns `# | Question | Blocks | Options seen | Answer | Status`; `specgate questions`, the studio and the draft checklist SHALL read an answer the same way — the `Answer` (or `Respuesta`) cell, or a line `Answer (Qn): …` under the table — and SHALL not count an empty cell or a placeholder (`TBD`, `pending`, `pendiente`) as an answer.

#### Scenario: SCN-429a — The same answer everywhere

- GIVEN Q1 answered in its `Answer` cell and Q2 by a line `Answer (Q2): 30 days` under the table
- WHEN `specgate questions`, the studio and the draft checklist read `questions.md`
- THEN all three count Q1 and Q2 as answered

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-430 — The studio answers quickly and never fails in silence

The studio SHALL read the project's state without starting a CLI process, reusing it until a spec file changes; SHALL keep a button busy, refusing a second click, while its request is in flight; SHALL show a read that fails, with the reason and a retry, instead of keeping the last view without a word; and SHALL redraw a view only when what it shows changed.

#### Scenario: SCN-430a — A refresh that costs nothing

- GIVEN the studio open on Home and no spec file changed
- WHEN the view refreshes
- THEN no process is started and the page is not redrawn

#### Scenario: SCN-430b — A failed read is said

- GIVEN a `questions.md` the studio cannot read
- WHEN Questions refreshes
- THEN the page says it could not read it, why, and offers to retry

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-431 — The agent is chosen in the studio

The studio SHALL offer, where no agent is configured, Claude Code, Codex and a command of one's own, the ones found on the PATH marked so and the first of them chosen; choosing SHALL write the agent as `specgate config set agent` does, through a request that needs the studio's token, and Build SHALL then start. A configured command SHALL have `{prompt_file}` replaced by the file's path in quotes, so a path with spaces reaches the agent whole.

#### Scenario: SCN-431a — Claude Code chosen from the studio

- GIVEN a project with no agent configured and `claude` on the PATH
- WHEN Claude Code is chosen in Build
- THEN `harness.config.yaml` holds the Claude Code agent, and Build can start

#### Scenario: SCN-431b — A temporary folder with a space

- GIVEN the agent `claude -p < {prompt_file}` and a prompt file under `C:\Users\Juan Perez\AppData\Local\Temp`
- WHEN the command is built
- THEN the path reaches it quoted, as one argument

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
