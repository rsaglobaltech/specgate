# Delta — harness

## ADDED Requirements

### Requirement: REQ-184 — The harness does not fill the disk

The system SHALL copy into the in-flight view only the files git tracks or would track, never what the project ignores (build caches, dependencies, test output), and SHALL not start a requirement when less than 2 GB (or `SPECGATE_HARNESS_MIN_FREE_GB`) is free where its worktree goes, failing it with the free space, the threshold and how to change it.

#### Scenario: SCN-184a — The in-flight copy takes what git keeps

- GIVEN a project whose `.next/`, `test-results/` and `node_modules/` are ignored, with a tracked file and an untracked one
- WHEN the files to copy are listed
- THEN they are the tracked file, the untracked one and `.gitignore`, and nothing under the ignored folders

#### Scenario: SCN-184b — A nearly full disk stops the requirement before it starts

- GIVEN 0.1 GB free and a threshold of 2 GB
- WHEN a requirement is about to start
- THEN it is not started, and the reason gives 0.1 GB free, the 2 GB needed and where

<!-- specgate:trace status=Implemented test=tests/unit/harness-hardening.test.ts actor=Developer kind=functional -->

### Requirement: REQ-185 — Re-running delivered requirements works in the order asked

The system SHALL run the requirements `--req` names in the order given, and SHALL recreate, without `--force`, a requirement's branch that is already merged into the base; a branch with work not merged still needs `--resume` or `--force`.

#### Scenario: SCN-185a — --req runs in the order given

- GIVEN a plan ordering REQ-085, REQ-017, REQ-052
- WHEN the run is asked for REQ-017, REQ-052, REQ-085
- THEN it runs REQ-017, REQ-052, REQ-085; and without `--req` the plan's order stands

#### Scenario: SCN-185b — A merged branch is recreated

- GIVEN harness/REQ-017 exists and is merged into the base
- WHEN REQ-017 runs without `--force`
- THEN its branch is recreated; and an unmerged branch is skipped unless `--force` or `--resume` is given

<!-- specgate:trace status=Implemented test=tests/unit/harness-hardening.test.ts actor=Developer kind=functional -->

### Requirement: REQ-186 — One harness run per working copy

The system SHALL hold a lock beside the git-ignored events while a harness run works in a project, SHALL refuse a second run while the holder is alive, SHALL ignore a lock whose process is gone, SHALL warn `specgate check` that its tests can break the run's post-merge gate, and SHALL say, when a post-merge gate fails, that it ran in the working copy.

#### Scenario: SCN-186a — A second run is refused

- GIVEN a harness run holds the working copy
- WHEN another run tries to take it
- THEN it is refused, and once released no lock remains

#### Scenario: SCN-186b — A stale lock does not block

- GIVEN a lock left by a process that no longer exists
- WHEN a run starts
- THEN it takes the working copy

<!-- specgate:trace status=Implemented test=tests/unit/harness-hardening.test.ts actor=Developer kind=functional -->
