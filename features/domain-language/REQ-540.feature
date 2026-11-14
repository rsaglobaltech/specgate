Feature: The entity model is generated

  @REQ-540 @SCN-540a
  Scenario: A pack's aggregate becomes an entity
    Given a project whose `docs/specs/aggregates.md` lists `Invoice` and `Payment`, as the `billing` pack writes it
    When a tool runs `specgate check`, then edits `docs/specs/model.md` by hand and runs `specgate validate --json`
    Then the generated file has an `erDiagram` with `Invoice` and `Payment`, and `validate` reports `model_stale`
