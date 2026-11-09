Feature: status points at a brief still to fill in

  @REQ-243 @SCN-243a
  Scenario: A project forja just generated
    Given `docs/brief.md` with the client's text and `modules: []`, and only the adoption baseline REQ-001
    When `specgate status` runs
    Then its next step names `docs/brief.md` and `specgate draft`, not `specgate new`
