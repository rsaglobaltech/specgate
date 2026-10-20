Feature: A ready ticket opens a change checked against it

  @REQ-147 @SCN-147a
  Scenario: KAN-13 opens a change
    Given a Specgate project whose `alm.config.yaml` maps KAN-5 to `entry-exit`, and the exported KAN-13 "Register vehicle entry", child of KAN-5, with six criteria
    When the developer runs `specgate propose --from-ticket KAN-13.json`
    Then the change `kan-13-register-vehicle-entry` exists with `ticket.md`, `proposal.md` naming `ticket: KAN-13`, `DRAFTING.md` quoting the six criteria, and `specs/entry-exit/spec.md`, and its `change.yaml` names `ticket.md` as `brief:`

  @REQ-147 @SCN-147b
  Scenario: An epic nobody mapped
    Given the same project with no `epics:` map
    When the developer runs `specgate propose --from-ticket KAN-13.json`
    Then it exits 1 with `ticket_no_capability`, whose fix names `--capability` and the `epics:` map, and no change is opened

  @REQ-147 @SCN-147c
  Scenario: The copy edited to pass
    Given the opened `kan-13-register-vehicle-entry`, whose `ticket.md` has since been edited
    When the developer runs `specgate propose --from-ticket KAN-13.json`
    Then it reports `ticket_copy_edited` as an error and does not say "Ready to review"
