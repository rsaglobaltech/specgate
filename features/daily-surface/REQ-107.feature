Feature: The default help shows four verbs

  @REQ-107 @SCN-107a
  Scenario: A new developer reads the help
    Given a project initialised with `specgate init --yes`
    When the developer runs `specgate --help`
    Then the developer sees exactly 6 commands: `init`; `propose`, `apply`, `status`, `archive`; `check`
    And a last line naming `specgate --help --all`
    And `specgate --help --all` still lists `draft`, `done`, `change` and every other command
