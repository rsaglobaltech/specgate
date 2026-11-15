Feature: A story is done when every repository delivered its part

  @REQ-297 @SCN-297a
  Scenario: The story is done when every repository archived its part
    Given the story follow-shipment across fleet and web
    When fleet archives its change, and then web archives its own
    Then the story is not done with fleet archived and web open, and done once both are archived
