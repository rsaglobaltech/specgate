Feature: Decisions are recorded and superseded, never rewritten

  @REQ-546 @SCN-546a
  Scenario: A decision replaced
    Given a project with `docs/specs/adr/0001-use-postgres.md`, status `Accepted`
    When a tool runs `specgate adr supersede 0001 "Use SQLite for the edge"` then `specgate adr list --json`
    Then `0002-use-sqlite-for-the-edge.md` exists and names 0001; 0001's status is `Superseded by 0002` and its other lines are unchanged; and the list has both
