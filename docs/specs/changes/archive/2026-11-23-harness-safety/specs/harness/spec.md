# Delta — harness

## ADDED Requirements

### Requirement: REQ-573 — An interrupted run ends what it started and keeps its work

The system SHALL, when a harness run is interrupted — a signal to it or to the command it is running, or the run's process ending — end every command the run started, including those in a process group of their own, keep the requirement's worktree for `--resume`, and exit with status 130 and the finding `harness_run_error`.

#### Scenario: SCN-573a — Ctrl-C while the agent works

- GIVEN a harness run whose agent ignores SIGINT and SIGTERM
- WHEN the person presses Ctrl-C
- THEN the agent is no longer running and the requirement's worktree is still registered

#### Scenario: SCN-573b — The run killed outright

- GIVEN a harness run whose agent ignores SIGTERM
- WHEN the run's process is killed with SIGKILL
- THEN the agent is no longer running within seconds

<!-- specgate:trace status=Implemented feature=features/harness/REQ-573.feature actor=Developer kind=functional -->

### Requirement: REQ-574 — A chain undoes a merge to where the branch stood

The system SHALL, in `harness run --chain`, check that the merge commit and any amendment of it were recorded, and SHALL, when either fails or the gate fails after the merge, put the branch back to the commit it pointed at before the merge, leaving no change staged.

#### Scenario: SCN-574a — A merge commit the repository refuses

- GIVEN a chain run on a branch whose last commit is the person's, and a commit-msg hook that refuses the chain's merge commit
- WHEN the first requirement passes and is merged
- THEN the requirement fails naming the refused merge commit, and the branch points at the person's commit with its own tree and nothing staged

<!-- specgate:trace status=Implemented feature=features/harness/REQ-574.feature actor=Developer kind=functional -->

### Requirement: REQ-575 — Every command the harness runs ends at its deadline

The system SHALL run the architecture and test commands, the reviewer and adversary agents and the adversary's tests, the setup command and the PR command under the run's `--timeout`, ending each one and every process it started when the time is up.

#### Scenario: SCN-575a — A test command that hangs

- GIVEN a harness run with `--timeout 4` whose test command ignores SIGTERM and never ends
- WHEN the gate runs the test command
- THEN the run ends within the deadline's margin and the test command is no longer running

<!-- specgate:trace status=Implemented feature=features/harness/REQ-575.feature actor=Developer kind=functional -->

### Requirement: REQ-576 — A worker runs with every option of its run

The system SHALL give each worker of a run with `--concurrency` above 1 the options `--resume`, `--skip-not-ready`, `--strict-artifacts`, `--verbose`, `--push` and `--remote` the run was given, and SHALL pass the agent, test and PR commands in the worker's environment rather than on its command line, removing them from that environment once read.

#### Scenario: SCN-576a — Four requirements at once, resumed

- GIVEN a run with `--concurrency 4 --resume --push` and an agent command that holds a key
- WHEN each worker starts
- THEN each worker's arguments include `--resume` and `--push` and none of them holds the agent's command

<!-- specgate:trace status=Implemented feature=features/harness/REQ-576.feature actor=Developer kind=functional -->

### Requirement: REQ-577 — The agent does not choose the command that checks it

The system SHALL resolve the profile of a quality check (`builtin:review`, `builtin:adversary`) from the project the run belongs to, never from the requirement's worktree, where the agent writes.

#### Scenario: SCN-577a — A profiles file written by the agent

- GIVEN a requirement's worktree where the agent wrote `.harness/profiles.yaml`
- WHEN a review check's profile is resolved
- THEN it is read from the project's folder, not from the worktree

<!-- specgate:trace status=Implemented feature=features/harness/REQ-577.feature actor=Developer kind=functional -->
