Feature: A row the generated matrix fills in further is kept

  @REQ-677 @SCN-677a
  Scenario: More code than the hand-kept row listed
    Given a hand-kept matrix whose REQ-020 row names no code, and `src/orders.ts` mentioning REQ-020
    When the Developer runs `specgate matrix --migrate`
    Then the migration succeeds, REQ-020's row names `src/orders.ts`, and the output reports one row with `matrix_rows_richer`

  @REQ-677 @SCN-677b
  Scenario: A test the hand-kept row named and no file mentions
    Given a hand-kept matrix whose REQ-020 row names `tests/orders.test.ts`, and no file mentioning REQ-020
    When the Developer runs `specgate matrix --migrate`
    Then REQ-020's section in spec.md says `test=tests/orders.test.ts` in its trace, and its row still names it
