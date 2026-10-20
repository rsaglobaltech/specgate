Feature: The guide says when a brief is needed and how to write one

  @REQ-142 @SCN-142a
  Scenario: The page and the help
    Given the documentation and the CLI of this release
    When a test reads `specgate propose --help`, the page and the page's example brief
    Then the help names "No brief" for one behaviour, the page has steps 1 to 8 and a glossary and no "specgate draft" command, and the example brief passes `--check` with exit 0
