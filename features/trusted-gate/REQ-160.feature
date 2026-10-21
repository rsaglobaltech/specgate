Feature: Two changes that rewrite the same requirement are reported

  @REQ-160 @SCN-160a
  Scenario: Two tickets rewrite REQ-012
    Given a repository whose branch `feature/KAN-16-exit` holds an open change `kan-16-exit` that modifies REQ-012, and the developer is on `feature/KAN-13-entry`, whose open change `kan-13-entry` also modifies REQ-012
    When the developer runs `specgate check`
    Then it warns `change_overlap` for REQ-012, naming `kan-16-exit` and `feature/KAN-16-exit`

  @REQ-160 @SCN-160b
  Scenario: The other branch is already merged
    Given the same two changes, where `feature/KAN-16-exit` has since been merged into `feature/KAN-13-entry`
    When the developer runs `specgate check`
    Then it does not warn `change_overlap` for `kan-16-exit`
