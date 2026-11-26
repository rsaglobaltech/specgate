Feature: Each run's prompt and log, as it happens

  @REQ-704 @SCN-704a
  Scenario: A run read while it works
    Given `specgate eval conventions` running its task deliver-req-007, whose agent has printed "writing src/ausleihe.js" and not finished
    When the Developer reads that run's `log.jsonl` and `prompt.md`
    Then the log has its start and an output line with "writing src/ausleihe.js" and no end yet, and the prompt holds the skill's text and the task's

  @REQ-704 @SCN-704b
  Scenario: The list names the texts and the runs
    Given the exam conventions run once, its task with a hidden check
    When the Developer runs `specgate eval --list --json`
    Then conventions carries the skill's whole text, the whole text of its eval.yaml, the task's prompt and its check command, and the last exam's runs with their folders, each ended, with correct and the hidden check's exit
