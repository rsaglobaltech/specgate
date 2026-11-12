# Delta — harness

## ADDED Requirements

### Requirement: REQ-490 — A run on a dirty tree, when asked, says what it left out

The system SHALL, with `specgate harness run --allow-dirty`, run on a working tree with uncommitted or untracked files, cutting every requirement's branch and worktree from the last commit and leaving those files as they are in the working copy; SHALL say so in the JSON result as `dirty`, with `allowed` and `leftOut`, the paths left out; SHALL refuse `--allow-dirty` with `--chain`, which merges into that working copy; and without `--allow-dirty` SHALL still refuse a tree that is not clean, naming the flag in the message.

#### Scenario: SCN-490a — An uncommitted note stays out of the run

- GIVEN a committed project with `notes.md` untracked and `README.md` edited and not committed
- WHEN `specgate harness run --allow-dirty --format json` delivers REQ-000 with a fake agent
- THEN REQ-000 passes, its branch has no `notes.md`, the result has `dirty.allowed` true and `dirty.leftOut` listing `README.md` and `notes.md`, and both files are still in the working copy as they were

#### Scenario: SCN-490b — Without the flag, or with --chain

- GIVEN the same dirty project
- WHEN `specgate harness run --format json` runs, and then `specgate harness run --allow-dirty --chain --format json`
- THEN the first is refused with `harness_run_error` and a message that names `--allow-dirty`, and the second is refused because `--chain` merges into the working copy

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-491 — Stopping a run after the requirement in progress, from the command line

The system SHALL provide `specgate harness stop --after-current [--json]`, which asks the harness run working in the project to finish the requirement in progress and start no other, and answers `stop` with `requested` and the `run` it asked (its pid, its requirements and when it started); SHALL, when no run is working there, request nothing and answer `requested` false with the warning `harness_not_running`; and the run so stopped SHALL say in its JSON result `stopped`, with `by` `request`, the reason and the requirements `notAttempted`.

#### Scenario: SCN-491a — The run stops after REQ-000

- GIVEN a run of REQ-000, REQ-001 and REQ-002 whose agent for REQ-000 runs `specgate harness stop --after-current --json`
- WHEN the run ends
- THEN the stop answered `requested` true with the run's pid, REQ-000 passed, REQ-001 and REQ-002 were not attempted, and the run's JSON has `stopped.by` `request` and `stopped.notAttempted` REQ-001 and REQ-002

#### Scenario: SCN-491b — No run to stop

- GIVEN a project where no harness run is working
- WHEN `specgate harness stop --after-current --json` runs, and `specgate harness stop --json` without the flag
- THEN the first exits 0 with `requested` false and the warning `harness_not_running`, and writes no stop request; the second is a usage error whose fix names `--after-current`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-492 — The API asks a run to stop as the command does

The system SHALL export `harnessStop(dir, { afterCurrent: true })` from `@rsaglobaltech/specgate/api`, resolving to the same answer `specgate harness stop --after-current --json` prints for that project, typed in `types/api.d.ts`, and rejecting with `not_a_project` for a folder that is not a specgate project.

#### Scenario: SCN-492a — In-process and from the command line

- GIVEN a project where a harness run holds the run lock
- WHEN a program calls `harnessStop(dir, { afterCurrent: true })`, and later, with no run, both it and `specgate harness stop --after-current --json` answer
- THEN the first answer has `requested` true with the run's pid and the stop request exists; the two later answers are equal, with `requested` false

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-493 — Each pending requirement has an estimate that says its basis

The system SHALL add to `specgate plan --json` an `estimates` list, one entry per pending requirement, with its `time` in milliseconds and, when a profile in `.harness/profiles.yaml` declares `cost_per_run_hint`, its `cost`; each number SHALL carry its `basis` — `history` from that requirement's recorded runs, `size` from the time delivered requirements took per scenario step times its own steps, `average` from the project's time per delivered requirement — and the `samples` it rests on, and SHALL be `null` with basis `none` when nothing recorded supports it.

#### Scenario: SCN-493a — History, size, and nothing at all

- GIVEN a ledger in which REQ-001 failed once in 90 s and REQ-000 was delivered in 60 s, REQ-000 having 3 scenario steps and REQ-002 6, and a profile `fast` declaring `cost_per_run_hint` 0.5 that ran every attempt
- WHEN `specgate plan --json` runs, and again on the project with no ledger
- THEN REQ-001's time is 90000 ms and its cost 0.5, both with basis `history`; REQ-002's time is 120000 ms and its cost 1, both with basis `size`; and with no ledger every time is `null` with basis `none`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-494 — A question is recorded with its id as soon as the agent asks it

The system SHALL, while a harness run's agent works, write a question the agent records with `specgate ask` into the project and commit it as soon as it is asked, not when the run ends, and SHALL append to the requirement's events file a `question` event carrying its `id`, its `change` and its `file`, so that the question can be answered while the run goes on.

#### Scenario: SCN-494a — The id before the agent has finished

- GIVEN a fake agent that runs `specgate ask REQ-000 "Which currency?"` and then waits until the project's questions list Q1
- WHEN the harness runs REQ-000
- THEN the agent sees Q1 in the project while it still runs, the events file has a `question` event with `id` Q1, and the question is committed

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-495 — A requirement whose agent asked ends waiting for the answer

The system SHALL end the requirement whose agent asked as `question`, without waiting within the run for the answer, and SHALL say in its JSON result `waitingForAnswer`, with the question's `id`, `text`, `change`, `file` and the command that answers it, so that the requirement is run again once its answer is reviewed.

#### Scenario: SCN-495a — The result names the question to answer

- GIVEN a fake agent that asks "Which currency?" for REQ-000
- WHEN `specgate harness run --format json` ends
- THEN REQ-000's result is `question` after one attempt, with `waitingForAnswer.id` Q1, its text, and `answer` naming `specgate answer Q1`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-496 — The run streams one JSON event per line

The system SHALL, with `specgate harness run --format jsonl`, write on stdout one JSON object per line and nothing else: `run-start` with the queue and the files `--allow-dirty` left out; every event the run and the agent's adapter write to `.harness/events/<REQ>.jsonl`, the question with its id among them; `agent-start` and `agent-end` around each agent step; `output` with the agent's output as it comes; `result` with each requirement's result; and last `run-end` with the document `--format json` prints. It SHALL keep the events files as they are, and SHALL document the event schema in `types/api.d.ts` and `docs/harness-control.md`, the harness guide for tools that drive it.

#### Scenario: SCN-496a — A run of one requirement, line by line

- GIVEN a fake agent that prints "working on it" and writes a usage event
- WHEN `specgate harness run --format jsonl` delivers REQ-000
- THEN every stdout line parses as JSON; the first is `run-start` and the last `run-end`, whose `report` has the shape `--format json` prints and the result of the `result` event; between them come `attempt`, `agent-start`, an `output` with "working on it" before `agent-end`, the `usage` event, `gate` events and a `result` for REQ-000

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-497 — A parallel run streams every requirement's events whole

The system SHALL, with `--format jsonl` and `--concurrency` above 1, stream on the run's own stdout the events of every requirement that runs in a worker, each line whole, and SHALL end with a single `run-end` for the whole run.

#### Scenario: SCN-497a — Two requirements at once

- GIVEN REQ-001 and REQ-002, independent, and a fake agent that prints a line longer than a pipe writes at once
- WHEN `specgate harness run --format jsonl --concurrency 2` delivers both
- THEN every stdout line parses as JSON, there are `output` and `result` events for both requirements, and exactly one `run-end`, the last line

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
