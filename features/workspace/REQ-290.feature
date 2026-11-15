Feature: The workspace names its repositories

  @REQ-290 @SCN-290a
  Scenario: Init names the sibling projects
    Given the folders fleet and contracts, each a Specgate project, beside an empty folder ws
    When the developer runs `specgate workspace init --name truck-flote` in ws
    Then specgate.workspace.yaml names contracts at ../contracts with the role contracts and fleet at ../fleet with the role service

  @REQ-290 @SCN-290b
  Scenario: A repo with an unknown role is refused
    Given a specgate.workspace.yaml whose repo fleet has the role backend
    When the workspace is read
    Then it is refused with "fleet has the role backend: a role is service, web, library, contracts"
