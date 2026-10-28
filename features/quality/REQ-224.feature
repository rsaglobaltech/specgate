Feature: The tests kill the mutants on the lines a change touched

  @REQ-224 @SCN-224a
  Scenario: A survivor on a changed line fails it
    Given `mutation_score: 70`, a change to Order.java lines 10 and 11, and a PIT report with a killed mutant on line 10, a surviving one on line 11 and a surviving one on unchanged line 30
    When the check runs
    Then it fails with 50%, naming the survivor on line 11 and not the one on line 30

  @REQ-224 @SCN-224b
  Scenario: Stryker's statuses
    Given a Stryker report on the changed lines with Killed, Timeout, Survived and Ignored mutants
    When the score is computed
    Then it is 2 of 3, the ignored one left out
