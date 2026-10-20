Feature: Two changes that add the same id are reported

  @REQ-164 @SCN-164a
  Scenario: Both opened at the same second
    Given a branch `feature/PET-104-walk-in` whose open change adds REQ-010, and the developer on `feature/PET-103-international`, whose open change adds REQ-010 too
    When the developer runs `specgate check`
    Then it warns `change_id_clash` for REQ-010, naming the PET-104 change and its branch
