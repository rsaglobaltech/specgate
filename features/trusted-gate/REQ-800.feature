Feature: With `link: strict`, a comment does not link a test

  @REQ-800 @SCN-800a
  Scenario: A comment is not a link
    Given `link: strict`, and `tests/login.test.js` whose only mention of REQ-007 is `// REQ-007: covered elsewhere`
    When the matrix is derived
    Then REQ-007 has no test, and `specgate apply REQ-007` is refused with `apply_no_test`, its fix saying a comment does not count under `link: strict`

  @REQ-800 @SCN-800b
  Scenario: A test's name is a link
    Given `link: strict`, and `tests/login.test.js` with `test("REQ-007: a locked account is refused", …)`, and `const url = "http://x/REQ-008"` under a `// REQ-009` comment
    When the matrix is derived
    Then REQ-007 and REQ-008 are linked to `tests/login.test.js`, and REQ-009 is not
