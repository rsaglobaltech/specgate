Feature: A project forja generates is wired for Specgate's gate

  @REQ-651 @SCN-651a
  Scenario: pinta generated with pnpm
    Given a forja that generates pinta with pnpm, the scripts test and arch, and its first commit
    When the Developer runs `specgate init --forja pinta`
    Then pinta has spec.md, its test command is `pnpm test` and its architecture check `pnpm run arch`, and its last commit adopts Specgate with nothing left uncommitted
