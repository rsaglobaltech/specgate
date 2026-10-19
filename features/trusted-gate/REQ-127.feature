Feature: The base is never left red by a chain

  @REQ-127 @SCN-127a
  Scenario: Green alone, red together
    Given a chain whose second requirement passes on its own branch but breaks a test once merged
    When the developer runs `specgate harness run --chain`
    Then the branch ends at the first requirement's merge commit, and the second is reported failed at `post-merge gate`
