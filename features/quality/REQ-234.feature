Feature: Commit messages follow Conventional Commits 1.0.0

  @REQ-234 @SCN-234a
  Scenario: A message without a type fails the check, named
    Given a branch with the commits "feat(REQ-007): book a slot" and "Update stuff" since main
    When the commits check runs
    Then it fails naming the second by its hash and subject, saying it has no type

  @REQ-234 @SCN-234b
  Scenario: The grammar's rules
    Given the messages "feat: x", "fix(api)!: y", "feat:no space", "feature: z", "feat(): w", a body without a blank line, and "breaking change: v" as a footer
    When each is parsed
    Then the first two pass, the second as breaking, and each of the others fails with its rule

  @REQ-234 @SCN-234c
  Scenario: Specgate's own commits conform
    Given the messages the harness, the ticket opening, the studio and a contribution write
    When each is parsed
    Then none breaks a rule, the harness's naming the requirement as its scope
