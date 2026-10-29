Feature: Short names, and a readable table

  @REQ-348 @SCN-348a
  Scenario: truck-flote-fleet and truck-flote-web
    Given the sibling projects truck-flote-fleet and truck-flote-web
    When the developer runs `specgate workspace init`
    Then the repositories are fleet at ../truck-flote-fleet and web at ../truck-flote-web, and the output separates name and path
