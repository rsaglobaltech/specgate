Feature: One short page to start

  @REQ-475 @SCN-475a
  Scenario: Starting with an existing local project
    Given a developer with an existing local project and the documentation site
    When they open the Start page from the home page
    Then the existing-project path shows at most six steps, each with its command, from installing specgate to the first applied requirement, and getting-started and quickstart point to it
