Feature: One check across the repositories

  @REQ-292 @SCN-292a
  Scenario: One repository's gate fails the workspace
    Given a workspace whose repositories fleet and tracking both pass, then tracking's test command exits 3
    When the developer runs `specgate workspace check`
    Then it exits 1, and `workspace status` shows fleet passed and tracking failed
