Feature: propose opens a change, from an idea or from the brief

  @REQ-108 @SCN-108a
  Scenario: Propose from an idea
    Given a project with no open change
    When the developer runs `specgate propose add-dynamic-pricing`
    Then the developer sees `docs/specs/changes/add-dynamic-pricing/` with `proposal.md`, `tasks.md`, `change.yaml`, a delta skeleton at `specs/add-dynamic-pricing/spec.md`, and a reserved REQ range
    And the output ends with the next step, `specgate apply`, once the delta is written

  @REQ-108 @SCN-108b
  Scenario: Propose from the brief
    Given a project whose `docs/brief.md` has the modules billing and shipping, neither drafted
    When the developer runs `specgate propose --from-brief` and then `specgate propose --from-brief billing`
    Then the first run names billing as the next module, and the second opens the draft change `draft-billing` with `DRAFTING.md`, exactly as `specgate draft billing` does
