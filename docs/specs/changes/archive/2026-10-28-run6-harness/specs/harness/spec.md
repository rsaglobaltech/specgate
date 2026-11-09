# Delta — harness

## ADDED Requirements

### Requirement: REQ-264 — The harness gives Claude Code permission to write

The system SHALL, when the agent command of `harness run` runs Claude Code in print mode (`claude -p`) with no permission flag of its own, add `--permission-mode acceptEdits` right after `claude` and say so, as the drafting commands do; and SHALL end a requirement after an attempt that wrote no file, naming the agent's permissions and `docs/agent-setup.md`, instead of running the same command again.

#### Scenario: SCN-264a — The documented Claude Code command

- GIVEN the agent command `claude -p < {prompt_file} | specgate harness events --from claude`
- WHEN the harness prepares it
- THEN it runs `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and a command that already says `--allowedTools` runs as written

#### Scenario: SCN-264b — An agent that writes nothing

- GIVEN an agent that exits 0 and writes no file, and three attempts allowed
- WHEN `harness run` runs the requirement
- THEN it makes one attempt, and says the agent produced no files and to see `docs/agent-setup.md`

<!-- specgate:trace status=Implemented test=tests/unit/harness-run6.test.ts actor=Developer kind=functional -->

### Requirement: REQ-268 — Every prompt reads the requirement where the harness found it

The system SHALL build every prompt of a harness run — the implementer's, the reviewer's and the adversary's — from the project as it will be after its open changes are archived, so a requirement of a reviewed, unarchived draft reaches each of them with its statement and scenarios.

#### Scenario: SCN-268a — The review of a draft's requirement

- GIVEN REQ-005 is written only in the open change `draft-flota`
- WHEN the harness builds the reviewer's prompt for REQ-005
- THEN the prompt holds REQ-005's statement, and does not say that `spec.md` has no section for it

<!-- specgate:trace status=Implemented test=tests/unit/harness-run6.test.ts actor=Developer kind=functional -->

### Requirement: REQ-269 — The harness report counts each requirement once

The system SHALL count, in `harness report`, each requirement once with the outcome of its latest run, while the cost per delivered requirement keeps the time of every run; and SHALL keep in the ledger a run that was stopped before it finished, with the requirement it was on reported as stopped.

#### Scenario: SCN-269a — A failed run, then a passing one

- GIVEN two recorded runs of REQ-002, the first failed after 7 minutes and the second passed after 11
- WHEN `harness report` sums them up
- THEN it says 1 of 1 requirements passed, none failed, nothing spent every attempt, and 18 minutes per delivered requirement

#### Scenario: SCN-269b — A run stopped by hand

- GIVEN a `harness run` on REQ-002 that is killed while its agent works
- WHEN `harness report` reads the ledger
- THEN the run is there, with REQ-002 reported as stopped

<!-- specgate:trace status=Implemented test=tests/unit/harness-run6.test.ts actor=Developer kind=functional -->

### Requirement: REQ-271 — The agent is kept in harness.config.yaml

The system SHALL keep the agent command with `specgate config set agent "<command>"`, written to `harness.config.yaml` with the permission REQ-264 adds; SHALL name the step in `status` while requirements are to do and no agent is set; and SHALL end a `harness run` given `--agent` on a project with none set with the command that keeps it.

#### Scenario: SCN-271a — Setting the agent once

- GIVEN a project with requirements to do and no `agent:` in `harness.config.yaml`
- WHEN the person runs `status`, then `specgate config set agent "claude -p < {prompt_file}"`
- THEN `status` named `specgate config set agent`, and `harness.config.yaml` says `agent: "claude --permission-mode acceptEdits -p < {prompt_file}"`

<!-- specgate:trace status=Implemented test=tests/unit/harness-run6.test.ts actor=Developer kind=functional -->
