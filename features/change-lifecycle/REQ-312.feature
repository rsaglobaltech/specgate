Feature: How many people a layer needs

  @REQ-312 @SCN-312a
  Scenario: Two architects for the design
    Given `approvals: { quorum: { design: 2 } }` and two people in the architect role
    When the first of them approves the design
    Then the design still waits for one approval, and it is approved once the second does; the same person twice counts once
