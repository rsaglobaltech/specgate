Feature: An approved change's scenarios are feature files before any code

  @REQ-660 @SCN-660a
  Scenario: Approved, before any code
    Given a project whose draft-pedidos has REQ-031 with the scenarios SCN-031 and SCN-032
    When the Developer approves draft-pedidos's discover, design and tasks layers
    Then `features/pedidos/REQ-031.feature` exists, tagged `@change:draft-pedidos`, with SCN-031 and SCN-032 tagged in it

  @REQ-660 @SCN-660b
  Scenario: Archived, the tag dropped
    Given draft-pedidos approved and every requirement applied
    When the Developer archives draft-pedidos
    Then `features/pedidos/REQ-031.feature` keeps its scenarios and no longer has `@change:draft-pedidos`
