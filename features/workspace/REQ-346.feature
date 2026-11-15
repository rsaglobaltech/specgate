Feature: The live view shows a story's title as it is written

  @REQ-346 @SCN-346a
  Scenario: A title with an accent
    Given follow-shipment titled "El cliente sigue su envío"
    When the developer reads `/live.json` from the studio of the workspace
    Then its content type says charset=utf-8 and the story's title is "El cliente sigue su envío"
