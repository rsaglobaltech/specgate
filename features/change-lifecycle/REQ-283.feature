Feature: A 0.27 change stays valid, and names the upgrade

  @REQ-283 @SCN-283a
  Scenario: A change written with 0.27
    Given a change with `proposal.md`, `tasks.md`, a valid delta and `schema: spec-driven`
    When `specgate change validate` runs
    Then it passes with exit 0 and a `layer_no_design` warning whose fix names `specgate migrate 1.0`

  @REQ-283 @SCN-283b
  Scenario: The migration's design
    Given a proposal whose Approach says "a pricing table per region" and whose criteria list `AC-1: peak rate above 100 orders`
    When the migration asks for its design
    Then the design's Mechanisms carry "a pricing table per region" and list `AC-1` to be answered
