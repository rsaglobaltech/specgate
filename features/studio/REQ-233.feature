Feature: The studio saves the specification in git before a build

  @REQ-233 @SCN-233a
  Scenario: The brief edited in the studio is committed
    Given docs/brief.md and a change's change.yaml modified and not committed, and a requirement ready to build
    When a build is started from the studio
    Then both files are in a new commit whose message says it came from the studio, the tree is clean, and the build starts

  @REQ-233 @SCN-233b
  Scenario: Code left uncommitted stops the build
    Given src/app.ts modified and not committed
    When a build is started from the studio
    Then it is refused naming src/app.ts, and nothing is committed
