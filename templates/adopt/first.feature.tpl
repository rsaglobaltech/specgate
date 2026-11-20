Feature: The project builds and its tests run
  The project was set up for spec-driven development before any code was
  written. The first test meets this scenario: it shows that the build works
  before the first behaviour is specified.

  Scenario: The test suite runs
    Given the project is built from a clean checkout
    When the full test suite runs
    Then it passes, with at least one test
