Feature: Build a story in every repository at once

  @REQ-324 @SCN-324a
  Scenario: A dry run names each repository's harness
    Given the story follow-shipment with an open sub-change in fleet adding REQ-003 and in tracking adding REQ-005
    When the developer runs `specgate workspace harness run --story follow-shipment --dry-run`
    Then it names a harness for fleet on REQ-003 and one for tracking on REQ-005, and starts none

  @REQ-324 @SCN-324b
  Scenario: One red base, no harness
    Given the same story, and fleet's REQ-000 Implemented with no test
    When the developer runs `specgate workspace harness run --story follow-shipment`
    Then it exits non-zero naming fleet, and no harness has started in either repository
