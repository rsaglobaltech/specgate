Feature: The project's preferences and the agents, in Settings

  @REQ-442 @SCN-442a
  Scenario: The test command changed in Settings
    Given a project whose `test_cmd` is `npm test`
    When Settings sets it to `npm run test:unit`
    Then `specgate config get test_cmd` answers `npm run test:unit`, and an unknown key is refused
