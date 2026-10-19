# Delta — live-harness

## Purpose

Delight on top of the gate: see what the harness and its agent are doing while
they work, think with the agent before a change exists, and learn the loop on
one's own repository without risking it.

## ADDED Requirements

### Requirement: REQ-128 — The harness records each requirement's run as events

The system SHALL, during `specgate harness run`, append one JSON line per event to `.harness/events/<REQ>.jsonl` in the project — the attempt's start and end with its result, each gate stage with its result, and the merge of `--chain` — each line carrying `t` in epoch seconds, `req`, `attempt` and `type`; it SHALL set `AGENT_EVENTS_FILE` to that file's absolute path, with `AGENT_EVENTS_REQ` and `AGENT_EVENTS_ATTEMPT`, in the agent's environment; and it SHALL keep `.harness/events/` out of git.

#### Scenario: SCN-128a — One requirement, one attempt

- GIVEN a project whose harness delivers REQ-002 at the first attempt
- WHEN the developer reads `.harness/events/REQ-002.jsonl`
- THEN it holds an attempt start, a gate line for each stage with result `pass`, and an attempt end with result `pass`, each with `req` "REQ-002" and `attempt` 1
- AND the agent saw `AGENT_EVENTS_FILE` naming that file, and `git status` lists nothing under `.harness/`

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-128.feature kind=functional actor=Developer -->

### Requirement: REQ-129 — Claude Code's steps become events

The system SHALL, on `specgate harness events --from claude`, read Claude Code's `--output-format stream-json` from standard input, append to `AGENT_EVENTS_FILE` one `step` line per tool call — its `kind` (read, search, edit, write, test, gate, shell or other), its `target` (the file path, or the command) and its result — and one `message` line per assistant text shortened to 600 characters, and SHALL print the run's final result text to standard output, so it can stand at the end of an agent command's pipe.

#### Scenario: SCN-129a — A read, an edit and a test run

- GIVEN a stream with a Read of src/a.ts, an Edit of src/a.ts and a Bash call running `npm test`, each with its result, and a final result "Done."
- WHEN it is piped into `specgate harness events --from claude` with `AGENT_EVENTS_FILE` set
- THEN the file gains three step lines with kinds read, edit and test and targets "src/a.ts", "src/a.ts" and "npm test", and standard output is "Done."

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-129.feature kind=functional actor=Developer -->

### Requirement: REQ-130 — No contents, output or secrets in an event

The system SHALL NOT write file contents, tool output, environment values or tokens into an event: a command is written with every token-like value replaced by `***`, and any value of an environment variable whose name says it is a secret is replaced by `***` wherever it appears.

#### Scenario: SCN-130a — A command with a token in it

- GIVEN a Bash call running "curl -H 'Authorization: Bearer abc123def456' https://api.example.com" with output "secret body", and `GITHUB_TOKEN=ghp_0123456789abcdefghijklmnop` in the environment of a call that echoes it
- WHEN the adapter records them
- THEN the events read "Authorization: Bearer ***" and "***" in place of the token, and contain neither "secret body" nor "abc123def456" nor the token's value

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-130.feature kind=non-functional actor=Security officer -->

### Requirement: REQ-131 — A live view in studio

The system SHALL serve, in `specgate studio`, a live view of the harness at `/live` built from `.harness/events/` — per requirement its attempt, phase, elapsed time, the files it touched, its test runs and its steps newest first — with the same model at `/live.json`, and SHALL push each change to the open page through server-sent events at `/live/stream`.

#### Scenario: SCN-131a — A requirement in progress

- GIVEN `.harness/events/REQ-002.jsonl` with an attempt start, a read, an edit of src/a.ts and a test step with 3 passing tests
- WHEN the developer opens `/live.json` from `specgate studio`
- THEN REQ-002 is listed in attempt 1, phase "test", with src/a.ts among its files and its last test run at 3 pass
- AND an event appended to the file reaches `/live/stream` without a reload

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-131.feature kind=functional actor=Developer -->

### Requirement: REQ-132 — Studio stays on the developer's machine

The system SHALL bind `specgate studio` to the loopback interface by default, SHALL refuse a request whose `Host` header names any other host, and SHALL bind elsewhere only when `--host` says so.

#### Scenario: SCN-132a — A request from another name

- GIVEN `specgate studio` running with its defaults
- WHEN a request arrives with `Host: attacker.example`
- THEN it is refused with status 403, and the server listens on 127.0.0.1 only

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-132.feature kind=non-functional actor=Security officer -->

### Requirement: REQ-133 — Explore before a change exists

The system SHALL, on `specgate explore` with a question, print a brief for thinking with an agent — the project's requirements by state, the open changes and their requirements, the open questions, and the question — and write nothing; with `--agent`, it SHALL hand that brief to the agent and undo anything the agent writes in the project, naming what it undid.

#### Scenario: SCN-133a — An agent that tries to write

- GIVEN a project in git with an open change and an agent command that prints an answer and writes notes.md
- WHEN the developer runs `specgate explore "Should refunds be partial?" --agent` with that command
- THEN the agent's answer is shown, notes.md does not exist afterwards, the output names it as undone, and `git status` is as before

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-133.feature kind=functional actor=Developer -->

### Requirement: REQ-134 — A guided tour of the loop that leaves the repository untouched

The system SHALL, on `specgate onboard --tour`, run the whole daily loop — `propose`, a requirement in the delta, a test that names it, `apply`, `archive` and `check` — on a temporary copy of the project, or on a small sample project when the project has no Node test setup, narrating each command and what it proved, and SHALL leave the project itself byte-for-byte unchanged, ending with the command to start for real.

#### Scenario: SCN-134a — The tour on a Node repository

- GIVEN an adopted Node repository
- WHEN the developer runs `specgate onboard --tour`
- THEN the output shows the four verbs and `check` in order, each passing, and ends naming `specgate propose`
- AND the repository's files are unchanged

<!-- specgate:trace test=tests/unit/live-view.test.ts feature=features/live-harness/REQ-134.feature kind=functional actor=Developer -->
