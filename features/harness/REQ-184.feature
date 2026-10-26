Feature: The harness does not fill the disk

  @REQ-184 @SCN-184a
  Scenario: The in-flight copy takes what git keeps
    Given a project whose `.next/`, `test-results/` and `node_modules/` are ignored, with a tracked file and an untracked one
    When the files to copy are listed
    Then they are the tracked file, the untracked one and `.gitignore`, and nothing under the ignored folders

  @REQ-184 @SCN-184b
  Scenario: A nearly full disk stops the requirement before it starts
    Given 0.1 GB free and a threshold of 2 GB
    When a requirement is about to start
    Then it is not started, and the reason gives 0.1 GB free, the 2 GB needed and where
