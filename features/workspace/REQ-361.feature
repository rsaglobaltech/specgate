Feature: Each criterion names the repositories that answer it

  @REQ-361 @SCN-361a
  Scenario: fleet answers AC-1, tracking AC-2
    Given follow-shipment whose `story.md` maps AC-1 to fleet and AC-2 to tracking
    When the developer runs `specgate workspace propose follow-shipment`
    Then fleet's Discover says it answers AC-1 and tracking answers AC-2, and tracking's says the reverse
