Feature: An earlier adoption's unspecified proposals are flagged

  @REQ-472 @SCN-472a
  Scenario: REQ-002 "Auth" left from an earlier adoption
    Given a project whose spec.md has REQ-002 "Auth" marked "Proposed, not specified", with a `TBD` test
    When the developer runs `specgate status --json`
    Then its findings include `proposal_unspecified` for REQ-002, whose fix names `specgate new` and removing the section
