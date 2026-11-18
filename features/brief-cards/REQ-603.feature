Feature: Quality requirements reach the drafts

  @REQ-603 @SCN-603a
  Scenario: Scoped and product-wide entries
    Given a Lingo brief with `modules: [courses, lessons]` whose `## Quality` says "- performance (lessons): A lesson opens in under 3 seconds." and "- reliability: Available 99.5% of each month."
    When the developer runs `specgate propose --from-brief courses`, then `specgate propose --from-brief lessons`
    Then courses' `DRAFTING.md` lists the reliability entry and not the performance one, and lessons' lists the performance entry and not the reliability one, each as a non-functional requirement to write

  @REQ-603 @SCN-603b
  Scenario: The new brief teaches both sections
    Given a project with no brief
    When the developer runs `specgate propose --from-brief --new-brief`
    Then `docs/brief.md` has a `## Quality` section naming ISO/IEC 25010, a `## Why` asking for a success you can measure, and `specgate propose --from-brief --check` reports no `B14` or `B15` finding on it
