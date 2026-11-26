@change:landing-evidence
Feature: The landing page shows where each control runs

  @REQ-763 @SCN-763a
  Scenario: Named figures
    Given the landing page as published
    When a screen reader reads it
    Then it finds a figure named for the trust boundary that names the outside judge, and one named for the guard's decision
