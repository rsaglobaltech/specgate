Feature: Objectives with a success you can measure

  @REQ-602 @SCN-602a
  Scenario: A why with no number
    Given a Lingo brief whose `## Why` says "Students lose track of their lessons. We want them to find them easily."
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 0 and reports `B15_why_unmeasured`

  @REQ-602 @SCN-602b
  Scenario: A measured why, and a brief without one
    Given one Lingo brief whose `## Why` says "A student finds today's lesson in under 10 seconds." and another with no `## Why` section
    When the developer runs `specgate propose --from-brief --check` on each
    Then neither reports a `B15` finding
