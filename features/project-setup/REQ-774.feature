Feature: Upgrading a pack keeps what the team wrote in spec.md

  @REQ-774 @SCN-774a
  Scenario: A delivered requirement stays delivered
    Given a project derived from a pack at v0.1.0, with REQ-001 marked `status=Implemented` in `spec.md`
    When the team runs `specgate specops sync --pack-version v0.2.0`, and v0.2.0 adds REQ-006 and leaves REQ-001 as it was
    Then `spec.md` still marks REQ-001 `status=Implemented`, and holds REQ-006
