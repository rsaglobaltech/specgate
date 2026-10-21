Feature: A change never replaces a requirement that moved under it

  @REQ-168 @SCN-168a
  Scenario: The other ticket merged first
    Given an open change that modifies REQ-009, checked once while REQ-009 read "An owner's telephone is exactly 10 digits", and a capability spec where REQ-009 now reads "An owner's telephone is 10 digits, or an international number"
    When the developer runs `specgate archive` for that change
    Then it refuses with `change_base_moved` naming REQ-009, and the capability spec is unchanged

  @REQ-168 @SCN-168b
  Scenario: The base moved before the branch caught up
    Given a branch whose open change modifies REQ-009, and a base branch `develop` where REQ-009 has been rewritten since the branch started
    When the developer runs `specgate check --base develop`
    Then it warns `change_base_moved` for REQ-009, naming `develop`

  @REQ-168 @SCN-168c
  Scenario: The delta was rewritten over the new text
    Given the change of SCN-168a, with its delta rewritten over the new REQ-009
    When the developer runs `specgate change validate` for it with `--rebased`, then `specgate check`
    Then `check` reports no `change_base_moved`
