Feature: A Docker check sees the repository of a worktree

  @REQ-266 @SCN-266a
  Scenario: semgrep in a harness worktree
    Given a worktree `wt` of a repository, and a Docker check
    When its `docker run` is built
    Then it mounts the repository's git folder at `/.specgate-git` read-only and sets `GIT_DIR=/.specgate-git/worktrees/wt` and `GIT_WORK_TREE=/src`
