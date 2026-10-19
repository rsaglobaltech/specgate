Feature: One loop, four verbs

  @REQ-116 @SCN-116a
  Scenario: The loop end to end
    Given a Node.js repository with code, a `package.json` and a passing `npm test`
    When the developer runs `specgate init`, `specgate propose add-greeting`, writes one requirement in the change's delta, a test naming it and the code, then runs `specgate status`, `specgate apply` and `specgate archive add-greeting`
    Then every command exits 0, the requirement is Implemented in its capability spec, and `specgate status` no longer lists it as pending
    And no other specgate command was run
