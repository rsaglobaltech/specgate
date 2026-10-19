Feature: Existing behaviour is preserved
  The project was adopted into spec-driven development with code already
  written. This baseline scenario pins the adoption invariant: nothing
  that worked before adoption may silently break after it.

  Scenario: Existing test suite stays green
    Given the project is built from a clean checkout
    When the full test suite runs
    Then every existing test passes
