Feature: A 0.27 change in progress is upgraded to the three layers

  @REQ-325 @SCN-325a
  Scenario: An open change written with 0.27
    Given a committed project with an open change `add-rates` written with `change new --schema spec-driven`, its proposal stating "Rates come from the provider."
    When the person runs `specgate migrate 1.0`
    Then `add-rates` has `discover.md` with the proposal's text, a `design.md`, its `tasks.md`, no `proposal.md`, and `schema: layered` in `change.yaml`

  @REQ-325 @SCN-325b
  Scenario: A delivered change
    Given the same project with an archived 0.27 change
    When the person runs `specgate migrate 1.0`
    Then every file under the archive is byte for byte as before
