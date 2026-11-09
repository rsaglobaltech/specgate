Feature: The README names only what was written

  @REQ-462 @SCN-462a
  Scenario: The layered profile
    Given `specgate init` with `ARCHITECTURE: layered`
    When the project is created
    Then its README lists `docs/specs/use-cases.md`, does not list `domain-model.md`, `commands.md`, `events.md`, `aggregates.md`, `status-model.md` or `AI_RULES.md`, and names `specgate check`
