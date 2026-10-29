Feature: Where each repository stands

  @REQ-291 @SCN-291a
  Scenario: Status shows each repository
    Given a workspace with fleet on its branch main and web, and no check run yet
    When the developer runs `specgate workspace status --json`
    Then fleet is a service on main with 1 requirement and its gate not run
