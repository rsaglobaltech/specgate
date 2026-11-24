# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-702 — Every exam listed, with its history

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-702.feature actor=Developer kind=functional -->

The system SHALL, on `specgate eval --list [--json]`, list each exam of the project (`evals/<skill>/eval.yaml`) with its skill's name and file, the skill's version now, its agent, the runs per task, each task's id and whether it has a hidden check, its history one row per exam, and per version the last exam's correct and good with the trend against the version before it.

> "And the evals, skills and exams?" (2026-11-23): the studio shows them from this list.

#### Scenario: SCN-702a — Two versions of the conventions skill

- GIVEN the exam conventions with a task deliver-req-007 holding a hidden check, examined at version a1 (3/3 correct, good 0.8) then at version b2 (2/3 correct, good 0.8)
- WHEN the Developer runs `specgate eval --list --json`
- THEN conventions is listed with its task deliver-req-007 marked hidden, two history rows, and b2 against a1: correct worse, good same

### Requirement: REQ-703 — An exam in progress says how far it got

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-703.feature actor=Developer kind=functional -->

The system SHALL, while `specgate eval <skill>` runs, keep `evals/<skill>/running.json` with when it started, its runs in all, how many ended and how many were correct, updated as each run ends and removed when the exam ends; and `eval --list` SHALL show it as the exam's `running`.

#### Scenario: SCN-703a — Half way through

- GIVEN `specgate eval conventions` with 4 runs, 2 ended and 1 correct
- WHEN the Developer runs `specgate eval --list --json`
- THEN conventions shows running with 4 runs, 2 ended and 1 correct; and once the exam ends, no running and no running.json

### Requirement: REQ-704 — Each run's prompt and log, as it happens

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-704.feature actor=Developer kind=functional -->

The system SHALL keep, for each run of an exam, in `evals/<skill>/runs/<stamp>/<task>-<n>/`, the prompt the agent was handed (`prompt.md`) and a log (`log.jsonl`) appended as the run happens — its start, each chunk the agent printed, `specgate check`'s exit and summary, the hidden check's exit and output, and its end with correct and good —; SHALL keep the folders of the last 5 exams only; and `eval --list` SHALL add the skill's whole text, the exam file's whole text, each task's prompt and check command, and the last exam's runs with their folder and state.

> "I have to be able to see the exam's text, the prompts, a kind of logs in real time" (2026-11-23).

#### Scenario: SCN-704a — A run read while it works

- GIVEN `specgate eval conventions` running its task deliver-req-007, whose agent has printed "writing src/ausleihe.js" and not finished
- WHEN the Developer reads that run's `log.jsonl` and `prompt.md`
- THEN the log has its start and an output line with "writing src/ausleihe.js" and no end yet, and the prompt holds the skill's text and the task's

#### Scenario: SCN-704b — The list names the texts and the runs

- GIVEN the exam conventions run once, its task with a hidden check
- WHEN the Developer runs `specgate eval --list --json`
- THEN conventions carries the skill's whole text, the whole text of its eval.yaml, the task's prompt and its check command, and the last exam's runs with their folders, each ended, with correct and the hidden check's exit
