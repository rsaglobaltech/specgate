Feature: Questions in the app

  @REQ-210 @SCN-210a
  Scenario: Open and to review
    Given Q6 is open with options listed and Q1 is answered with its assumption to review
    When Questions is read
    Then Q6 is listed with its options and form, and Q1 under the answers to confirm
