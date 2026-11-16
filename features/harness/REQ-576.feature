Feature: A worker runs with every option of its run

  @REQ-576 @SCN-576a
  Scenario: Four requirements at once, resumed
    Given a run with `--concurrency 4 --resume --push` and an agent command that holds a key
    When each worker starts
    Then each worker's arguments include `--resume` and `--push` and none of them holds the agent's command
