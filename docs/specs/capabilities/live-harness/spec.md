# Live Harness

## Purpose

Delight on top of the gate: see what the harness and its agent are doing while
they work, think with the agent before a change exists, and learn the loop on
one's own repository without risking it.

## Requirements

### Requirement: REQ-128 — The harness records each requirement's run as events

The system SHALL, during `specgate harness run`, append one JSON line per event to `.harness/events/<REQ>.jsonl` in the project — the attempt's start and end with its result, each gate stage with its result, and the merge of `--chain` — each line carrying `t` in epoch seconds, `req`, `attempt` and `type`; it SHALL set `AGENT_EVENTS_FILE` to that file's absolute path, with `AGENT_EVENTS_REQ` and `AGENT_EVENTS_ATTEMPT`, in the agent's environment; and it SHALL keep `.harness/events/` out of git.

#### Scenario: SCN-128a — One requirement, one attempt

- GIVEN a project whose harness delivers REQ-002 at the first attempt
- WHEN the developer reads `.harness/events/REQ-002.jsonl`
- THEN it holds an attempt start, a gate line for each stage with result `pass`, and an attempt end with result `pass`, each with `req` "REQ-002" and `attempt` 1
- AND the agent saw `AGENT_EVENTS_FILE` naming that file, and `git status` lists nothing under `.harness/`

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-128.feature kind=functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-129 — Claude Code's steps become events

The system SHALL, on `specgate harness events --from claude`, read Claude Code's `--output-format stream-json` from standard input, append to `AGENT_EVENTS_FILE` one `step` line per tool call — its `kind` (read, search, edit, write, test, gate, shell or other), its `target` (the file path, or the command) and its result — and one `message` line per assistant text shortened to 600 characters, and SHALL print the run's final result text to standard output, so it can stand at the end of an agent command's pipe.

#### Scenario: SCN-129a — A read, an edit and a test run

- GIVEN a stream with a Read of src/a.ts, an Edit of src/a.ts and a Bash call running `npm test`, each with its result, and a final result "Done."
- WHEN it is piped into `specgate harness events --from claude` with `AGENT_EVENTS_FILE` set
- THEN the file gains three step lines with kinds read, edit and test and targets "src/a.ts", "src/a.ts" and "npm test", and standard output is "Done."

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-129.feature kind=functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-130 — No contents, output or secrets in an event

The system SHALL NOT write file contents, tool output, environment values or tokens into an event: a command is written with every token-like value replaced by `***`, and any value of an environment variable whose name says it is a secret is replaced by `***` wherever it appears.

#### Scenario: SCN-130a — A command with a token in it

- GIVEN a Bash call running "curl -H 'Authorization: Bearer abc123def456' https://api.example.com" with output "secret body", and `GITHUB_TOKEN=ghp_0123456789abcdefghijklmnop` in the environment of a call that echoes it
- WHEN the adapter records them
- THEN the events read "Authorization: Bearer ***" and "***" in place of the token, and contain neither "secret body" nor "abc123def456" nor the token's value

<!-- specgate:trace actor=Security feature=features/live-harness/REQ-130.feature kind=non-functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-131 — A live view in studio

The system SHALL serve, in `specgate studio`, a live view of the harness at `/live` built from `.harness/events/` — per requirement its attempt, phase, elapsed time, the files it touched, its test runs and its steps newest first — with the same model at `/live.json`, and SHALL push each change to the open page through server-sent events at `/live/stream`.

#### Scenario: SCN-131a — A requirement in progress

- GIVEN `.harness/events/REQ-002.jsonl` with an attempt start, a read, an edit of src/a.ts and a test step with 3 passing tests
- WHEN the developer opens `/live.json` from `specgate studio`
- THEN REQ-002 is listed in attempt 1, phase "test", with src/a.ts among its files and its last test run at 3 pass
- AND an event appended to the file reaches `/live/stream` without a reload

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-131.feature kind=functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-132 — Studio stays on the developer's machine

The system SHALL bind `specgate studio` to the loopback interface by default, SHALL refuse a request whose `Host` header names any other host, and SHALL bind elsewhere only when `--host` says so.

#### Scenario: SCN-132a — A request from another name

- GIVEN `specgate studio` running with its defaults
- WHEN a request arrives with `Host: attacker.example`
- THEN it is refused with status 403, and the server listens on 127.0.0.1 only

<!-- specgate:trace actor=Security feature=features/live-harness/REQ-132.feature kind=non-functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-133 — Explore before a change exists

The system SHALL, on `specgate explore` with a question, print a brief for thinking with an agent — the project's requirements by state, the open changes and their requirements, the open questions, and the question — and write nothing; with `--agent`, it SHALL hand that brief to the agent and undo anything the agent writes in the project, naming what it undid.

#### Scenario: SCN-133a — An agent that tries to write

- GIVEN a project in git with an open change and an agent command that prints an answer and writes notes.md
- WHEN the developer runs `specgate explore "Should refunds be partial?" --agent` with that command
- THEN the agent's answer is shown, notes.md does not exist afterwards, the output names it as undone, and `git status` is as before

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-133.feature kind=functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-134 — A guided tour of the loop that leaves the repository untouched

The system SHALL, on `specgate onboard --tour`, run the whole daily loop — `propose`, a requirement in the delta, a test that names it, `apply`, `archive` and `check` — on a temporary copy of the project, or on a small sample project when the project has no Node test setup, narrating each command and what it proved, and SHALL leave the project itself byte-for-byte unchanged, ending with the command to start for real.

#### Scenario: SCN-134a — The tour on a Node repository

- GIVEN an adopted Node repository
- WHEN the developer runs `specgate onboard --tour`
- THEN the output shows the four verbs and `check` in order, each passing, and ends naming `specgate propose`
- AND the repository's files are unchanged

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-134.feature kind=functional status=Implemented test=tests/unit/live-view.test.ts -->

### Requirement: REQ-175 — A base the gate already fails is said before any agent runs

The system SHALL, before `specgate harness run` creates a worktree or invokes an agent, validate the base with `validate --strict` as `specgate check` does, and when it fails TDD-1 or TDD-2 on a requirement outside the run (a status past Draft with no test, which no attempt may fix) SHALL stop with exit status 1, listing those findings and the fix (write those tests, move those requirements back to Draft, or `--skip-baseline`), with no `harness/REQ-NNN` branch created; findings about the requirements being run SHALL not stop it, and `--skip-baseline` SHALL run the requirements anyway.

#### Scenario: SCN-175a — A red base stops the run before the agent

- GIVEN a committed project where REQ-002 is Approved with no test, so `validate --strict` fails TDD-1
- WHEN the developer runs `specgate harness run --req REQ-001` with an agent configured
- THEN the run exits 1 saying the base already fails the gate on requirements outside the run, naming TDD-1 and `--skip-baseline`, the agent never runs and no `harness/*` branch exists

#### Scenario: SCN-175b — `--skip-baseline` runs it anyway

- GIVEN the same project
- WHEN the developer runs `specgate harness run --req REQ-001 --skip-baseline`
- THEN the agent runs

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-175.feature kind=functional status=Implemented test=tests/cli.test.ts -->

### Requirement: REQ-179 — The live view reads like a CI run

The system SHALL give each requirement of the live model its title and module from the specification (an open change's delta or a capability spec, never a DRAFTING.md example), and SHALL lay `/live` out as a sidebar of the run's requirements by module with status and duration, a summary of the run, a graph of its requirements in the order they ran, and the steps of the selected requirement — Agent, each gate stage, the stages still to come — with the agent's stream as the log of the step in progress; self-contained, every value set as text, in light and dark.

#### Scenario: SCN-179a — Titles and modules in the live model

- GIVEN a project whose open change draft-diario defines REQ-022 "Registrar una clase con su fecha", whose DRAFTING.md shows an example REQ-022 with a placeholder for its title, and harness events for REQ-022
- WHEN the live model is read
- THEN REQ-022 has the title "Registrar una clase con su fecha" and the module "diario"

#### Scenario: SCN-179b — The page is laid out as a CI run

- GIVEN the live page
- WHEN it is served
- THEN it has the sidebar of requirements, the run's summary, the graph of jobs, the steps Agent, Specification, Architecture, Tests and Merge, and the log, loads nothing from another host and parses nothing from an event as HTML

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-179.feature kind=functional status=Implemented test=tests/unit/live-view-polish.test.ts -->

### Requirement: REQ-180 — A requirement of the live view opens into everything the project holds about it

The system SHALL serve, for one requirement id, its title, status, module, statement, the spec file and line that define it, its scenarios with their steps, its feature files, the tests that name it, its assumptions, every attempt with its result, duration, the stage it failed at and its gates, and the files its last attempt changed; it SHALL refuse an id that is not a requirement id, and SHALL take the last attempt to be the one that started last.

#### Scenario: SCN-180a — The requirement's text, scenarios and where they live

- GIVEN an open change whose delta defines REQ-024 with a scenario
- WHEN the details of REQ-024 are read
- THEN they hold its statement, its scenario with its steps, and the delta's path and line

#### Scenario: SCN-180b — The tests that name it, and every attempt with its files

- GIVEN a test that names REQ-024 and events for two attempts, the first failed at the tests
- WHEN the details of REQ-024 are read
- THEN they list the test, both attempts with their results and the stage the first failed at, and the files the last changed

#### Scenario: SCN-180c — A later run's attempt 1 is the last attempt

- GIVEN events of a run that failed on attempt 3, then of a later run whose attempt 1 passed
- WHEN the live model is read
- THEN the requirement's last attempt is the later run's attempt 1, passed

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-180.feature kind=functional status=Implemented test=tests/unit/live-detail.test.ts -->

### Requirement: REQ-181 — The live view groups by module and keeps its header in view

The system SHALL keep the live view's header and run summary in view while it scrolls, SHALL show the run in its centre as a matrix by module (one row per module, one segment per requirement, coloured passed, running, failed, blocked or queued, with requirements the run has not reached yet included), SHALL open the selected requirement into the tabs Steps, Requirement, Tests and files, Attempts and Agent, and SHALL offer a Traceability view of the matrix as it stands, one accordion per module, filtered as the viewer types.

#### Scenario: SCN-181a — A sticky header, modules that fold, and the requirement's tabs

- GIVEN the live page
- WHEN it is served
- THEN its header and summary are sticky, its modules fold, and the requirement has its tabs

#### Scenario: SCN-181b — The traceability matrix as it stands

- GIVEN a capability spec with a delivered requirement and an open change with a draft one
- WHEN the live matrix is read
- THEN both are rows, the first from the spec and the second from the change, each with its module, tests and status

#### Scenario: SCN-181c — The run as a matrix by module

- GIVEN the live page
- WHEN it is served
- THEN its centre is a matrix with a row per module and a segment per requirement, with a legend of passed, running, failed, blocked and queued, and no graph of jobs

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-181.feature kind=functional status=Implemented test=tests/unit/live-detail.test.ts -->

### Requirement: REQ-182 — The live view shows the run's work queue and the agent's session

The system SHALL record from Claude Code's stream the agent's model, version, permission mode and tool count, the context of each message counted once per message against the model's window, and the session's input, cache and output tokens, cost and turns; SHALL keep the run's queue and each attempt's prompt beside the events, git-ignored; and SHALL show the sidebar as the run's work queue (now, with model, context and output tokens; needs attention; up next, with an estimate; finished recently), the run's tokens and cost in its summary, and the selected attempt's session and prompt in an Agent tab.

#### Scenario: SCN-182a — The adapter records the model, the context and the totals

- GIVEN Claude Code's stream with an init line, a message streamed as two lines, a second message and a result with its usage and cost
- WHEN it is piped through `specgate harness events --from claude`
- THEN the events hold the model and its session, one usage line per message with its context and window, and the totals with cost and turns

#### Scenario: SCN-182b — The live model folds the session and gives the queue and totals

- GIVEN a queue of three requirements and the events of one with a prompt, its model and usage lines between its steps
- WHEN the live model is read
- THEN the requirement carries its model, current and peak context, output, prompt size, steps without the session lines, and the run its queue and, once the session ends, its totals and cost

#### Scenario: SCN-182c — The prompt is kept for the view

- GIVEN an attempt's prompt
- WHEN it is kept
- THEN it is read back from beside the git-ignored events

#### Scenario: SCN-182d — The sidebar is a work queue and the requirement has an Agent tab

- GIVEN the live page
- WHEN it is served
- THEN its sidebar has Now, Needs attention, Up next and Finished recently, and the requirement an Agent tab that reads the prompt

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-182.feature kind=functional status=Implemented test=tests/unit/live-agent.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-201.feature kind=functional status=Implemented test=tests/unit/studio-answer.test.ts -->

### Requirement: REQ-203 — Every open question, answered from the live view

The system SHALL carry in the live model every open question that `specgate questions` lists and every requirement in Needs Clarification with no question, and the live view SHALL list them under "Open questions" — those the agent asked stay under Needs attention — each question with the form that answers it and marks it reviewed, and each waiting requirement with the command that asks.

#### Scenario: SCN-203a — Open questions in the live view

- GIVEN draft-examen's Q6 is open and REQ-031 is Needs Clarification with no question
- WHEN the live model is read and the page served
- THEN the model holds Q6 with its change, text and blocks, and REQ-031 as waiting, and the page lists them under Open questions with an answer form for Q6

<!-- specgate:trace actor=Developer feature=features/live-harness/REQ-203.feature kind=functional status=Implemented test=tests/unit/studio-answer.test.ts -->
