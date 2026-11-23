# Delta — harness

## ADDED Requirements

### Requirement: REQ-578 — One run holds a working copy, and a dead run does not keep it

The system SHALL let only one harness run take a project's working copy, creating its lock only when none exists, SHALL take over a lock whose run is no longer alive, and SHALL hold the worktree lock in the repository's common git directory, also when the project is itself a worktree or a submodule, without waiting on a lock it cannot make.

#### Scenario: SCN-578a — A second run while the first holds the lock

- GIVEN a run holding the project's lock
- WHEN a second run asks for it, and later a run asks for a lock whose process has ended
- THEN the second run is refused, and the later run takes the dead run's lock

#### Scenario: SCN-578b — A project that is itself a worktree

- GIVEN a project whose `.git` is a file naming its repository
- WHEN the harness takes the worktree lock
- THEN it takes it at once, in the repository's git directory

<!-- specgate:trace status=Implemented feature=features/harness/REQ-578.feature actor=Developer kind=functional -->

### Requirement: REQ-579 — A run leaves nothing half-done behind

The system SHALL write the run record whole or not at all, SHALL create each prompt file readable by its owner only and remove it even when a step fails unexpectedly, SHALL delete the `harness/base/*` branches a run made once the run ends, and SHALL fail a requirement whose existing branch cannot be deleted to recreate it, with git's reason.

#### Scenario: SCN-579a — Throwaway bases after the run

- GIVEN a project with `harness/base/REQ-004` and `harness/REQ-004` branches
- WHEN a run ends
- THEN `harness/base/REQ-004` is gone and `harness/REQ-004` stays

<!-- specgate:trace status=Implemented feature=features/harness/REQ-579.feature actor=Developer kind=functional -->

### Requirement: REQ-580 — A value put in a command is one argument

The system SHALL put each value it substitutes into a gate command (`{req}`, `{scenario}`, `{feature_file}`) or into `pr_cmd` (`{branch}`, `{req}`) as one shell argument, leaving a value of letters, digits and `_./:@=,+-` as it is.

#### Scenario: SCN-580a — A feature path with a space

- GIVEN a requirement whose feature file is `features/the shop/REQ-007.feature`
- WHEN the test command `npx cucumber-js {feature_file}` is resolved
- THEN the path is one argument, and `{req}` alone is left as `REQ-007`

<!-- specgate:trace status=Implemented feature=features/harness/REQ-580.feature actor=Developer kind=functional -->

### Requirement: REQ-581 — No pass that was not said, and a timeout said as one

The system SHALL count a `builtin:review` check whose reviewer gave no `VERDICT:` line as failed, and SHALL report a test command ended at the deadline as timed out, with the time.

#### Scenario: SCN-581a — A reviewer that answers without a verdict

- GIVEN a gating review check whose reviewer prints no `VERDICT:` line
- WHEN the harness delivers a requirement
- THEN the requirement fails and the report says the reviewer gave no verdict

<!-- specgate:trace status=Implemented feature=features/harness/REQ-581.feature actor=Developer kind=functional -->

### Requirement: REQ-582 — Secrets stay out of what the run writes

The system SHALL replace with `***`, in the run record, in the prompt archive committed with each branch, in the gate's stage names and in the dry run, every token-like value and every value of an environment variable whose name says it holds a secret.

#### Scenario: SCN-582a — A gate output with a key in it

- GIVEN a run whose environment holds `MY_API_KEY` and whose output quotes it, a URL with a password and a GitHub token
- WHEN the run writes its record
- THEN none of the three appears in it; `***` does

<!-- specgate:trace status=Implemented feature=features/harness/REQ-582.feature actor=Developer kind=functional -->
