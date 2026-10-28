Feature: A second agent reviews or attacks the change as a check

  @REQ-227 @SCN-227a
  Scenario: A reviewer's FAIL advises, and its edits are undone
    Given a review check with `gate: false` whose agent edits src/work.ts, adds a file, and answers VERDICT: FAIL
    When the harness delivers a requirement whose implementer wrote src/work.ts
    Then the requirement passes, the branch carries the implementer's src/work.ts and not the reviewer's file, and the run record keeps the review as failed and advisory

  @REQ-227 @SCN-227b
  Scenario: An adversary that breaks the tests fails the attempt
    Given an adversary check with `gate: true` whose agent adds a case the tests fail on
    When the harness runs the requirement
    Then it fails at `quality check: adversary`, and the branch keeps the implementer's work without the adversary's file

  @REQ-227 @SCN-227c
  Scenario: Outside the harness, said and skipped
    Given a review check
    When `specgate quality run` runs
    Then the check is skipped, saying it runs inside the harness only
