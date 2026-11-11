# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-503 — Every check answer lists its stages

The system SHALL include in every `specgate check --json` answer, whether the gate passed or failed, `stages`: each stage of the gate in the order it runs — `ids`, `changes`, `validate`, `architecture`, `tests`, then one `quality` stage per check with its `name` — with its `command` (null when it has none), its `result` (`passed`, `failed`, `skipped` when it is not configured or could not run, or `not run` when an earlier stage failed) and its `findings`, each with `code`, `message`, `fix`, `file` and `line` when it has them; the `validate` stage SHALL carry validate's own findings.

#### Scenario: SCN-503a — validate fails on an Approved requirement no test names

- GIVEN a project whose REQ-001 is Approved and no test names it, with `test_cmd` set
- WHEN a tool runs `specgate check --json`
- THEN it exits 1, `ids` and `changes` are `passed` or `skipped`, `validate` is `failed` with validate's own `strict_tdd_1` finding, and `tests` is `not run` with its command

<!-- specgate:trace status=Approved actor=Developer kind=functional -->

### Requirement: REQ-504 — The last gate result is kept and read back

The system SHALL record, each time `specgate check` reaches a verdict, when it ran, the commit and branch it ran on, whether the working tree had uncommitted changes, whether it passed, its stages and its findings, in `last-check.json` in the repository's git folder (in `.specgate/`, ignored there, outside git), so the working tree is left as it was; and SHALL give it back with `specgate check --last --json` and the API's `lastCheck(dir)` as `lastCheck`, and, when no check has run, `lastCheck` null with the finding `last_check_none` whose fix is `specgate check`, exiting 0.

#### Scenario: SCN-504a — No check yet, then a failed one

- GIVEN a git repository with a specgate project where no check has run
- WHEN a tool runs `specgate check --last --json`, then `specgate check` with a failing test command, then `specgate check --last --json` and calls `lastCheck(dir)`
- THEN the first answer has `lastCheck` null and `last_check_none` with the fix `specgate check`; the second says the check failed, at what time and on the commit `git rev-parse HEAD` prints, with its `tests` stage `failed`; `lastCheck(dir)` gives the same; and `git status --porcelain` shows nothing new

<!-- specgate:trace status=Approved actor=Developer kind=functional -->
