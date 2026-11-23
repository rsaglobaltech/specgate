@change:eval-list
Feature: An exam in progress says how far it got

  @REQ-703 @SCN-703a
  Scenario: Half way through
    Given `specgate eval conventions` with 4 runs, 2 ended and 1 correct
    When the Developer runs `specgate eval --list --json`
    Then conventions shows running with 4 runs, 2 ended and 1 correct; and once the exam ends, no running and no running.json
