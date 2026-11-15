Feature: The actors diagram is generated

  @REQ-541 @SCN-541a
  Scenario: Two actors, one unknown
    Given a brief with the actors `Customer` and `Clerk`, REQ-001 with `actor=Customer` and REQ-002 with `actor=Admin`
    When a tool runs `specgate check` then `specgate validate --json`
    Then `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports `actor_unknown` for REQ-002 naming `Admin`

  @REQ-541 @SCN-541b
  Scenario: An actor written in another case
    Given a brief with the actor `Customer`, and REQ-001 with `actor=customer`
    When a tool runs `specgate check` then `specgate validate --json`
    Then `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports no `actor_unknown`
