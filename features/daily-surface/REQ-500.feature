Feature: status names each requirement's capability

  @REQ-500 @SCN-500a
  Scenario: An archived requirement, an open one and one in spec.md
    Given a project whose REQ-001 is in `spec.md`, REQ-002 in `docs/specs/capabilities/orders/spec.md`, and REQ-003 in the delta `specs/billing/spec.md` of an open change
    When a tool runs `specgate status --json`
    Then REQ-001 has `capability` null, REQ-002 has `orders` and REQ-003 has `billing`
