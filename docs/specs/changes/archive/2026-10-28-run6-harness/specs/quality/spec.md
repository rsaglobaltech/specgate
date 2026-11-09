# Delta — quality

## ADDED Requirements

### Requirement: REQ-266 — A Docker check sees the repository of a worktree

The system SHALL, when it runs a Docker check in a git worktree — whose `.git` is a file pointing into the main repository — mount the repository's git folder in the container read-only and point `GIT_DIR` and `GIT_WORK_TREE` at the worktree, so a tool that lists files with git, as semgrep does, works in the harness's worktrees as in the main tree.

#### Scenario: SCN-266a — semgrep in a harness worktree

- GIVEN a worktree `wt` of a repository, and a Docker check
- WHEN its `docker run` is built
- THEN it mounts the repository's git folder at `/.specgate-git` read-only and sets `GIT_DIR=/.specgate-git/worktrees/wt` and `GIT_WORK_TREE=/src`

<!-- specgate:trace status=Implemented test=tests/unit/quality-worktree.test.ts actor=Developer kind=functional -->

### Requirement: REQ-267 — A check that could not run is the person's

The system SHALL treat a gate check that is to write a SARIF report and wrote none — it timed out, or exited non-zero before reporting — as a check that could not run: the harness says so to the person with the check's output, does not hand it to the agent as findings to fix, and spends no further attempt on the requirement.

#### Scenario: SCN-267a — A scanner that fails before it reports

- GIVEN a gate check with `sarif:` whose command exits 2 and writes nothing, an agent that writes a file, and three attempts allowed
- WHEN `harness run` reaches the check
- THEN it makes one attempt, and says the check could not run, without "Fix what the check found"

<!-- specgate:trace status=Implemented test=tests/unit/quality-worktree.test.ts actor=Developer kind=functional -->
