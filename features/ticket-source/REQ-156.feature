Feature: The harness's commits name the ticket

  @REQ-156 @SCN-156a
  Scenario: A requirement of KAN-14
    Given an open change `kan-14-vehicle-type-catalog` with `ticket: KAN-14` whose delta adds REQ-002
    When the harness commits REQ-002 on its third attempt of three
    Then the commit message starts "KAN-14 REQ-002: implement via specgate harness"
