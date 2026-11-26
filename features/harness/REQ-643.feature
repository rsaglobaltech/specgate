Feature: A repository with no commit is refused before any agent runs

  @REQ-643 @SCN-643a
  Scenario: No commit yet
    Given a scaffolded project in a git repository with no commit
    When the Developer runs `specgate harness run --req REQ-000 --allow-dirty --format jsonl`
    Then the run ends with harness_no_commit, its message saying the repository has no commit yet and `git add -A && git commit`, and no "invalid reference"
