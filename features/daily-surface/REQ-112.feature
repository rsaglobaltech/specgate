Feature: archive waits for the code

  @REQ-112 @SCN-112a
  Scenario: A requirement still pending
    Given an open change that adds REQ-002 (Implemented) and REQ-003 (pending)
    When a person runs `specgate archive add-dynamic-pricing`
    Then the command exits 1 with code `archive_requirements_pending`, nothing is merged, and the message lists REQ-003
    And the last line reads `fix: specgate apply REQ-003`

  @REQ-112 @SCN-112b
  Scenario: Everything delivered
    Given the same change with REQ-002 and REQ-003 both Implemented
    When a person runs `specgate archive add-dynamic-pricing`
    Then both requirements are in the capability spec with status Implemented, their `.feature` files are in `features/`, and the change is under `docs/specs/changes/archive/`
    And an unchecked task in its `tasks.md` is reported as a warning, not a refusal

  @REQ-112 @SCN-112c
  Scenario: A change that only removes
    Given an open change whose delta only removes REQ-002
    When a person runs `specgate archive retire-legacy-export`
    Then the change is archived without waiting for any requirement
