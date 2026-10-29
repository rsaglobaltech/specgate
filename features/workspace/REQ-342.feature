Feature: Every repository receives the story

  @REQ-342 @SCN-342a
  Scenario: follow-shipment, drafted, split
    Given follow-shipment drafted with its intent and AC-1 "El cliente ve el camión"
    When the developer runs `specgate workspace propose follow-shipment`
    Then fleet's and tracking's `discover.md` hold the intent and AC-1, name truck-flote:follow-shipment, and do not say "in the workspace repository"
