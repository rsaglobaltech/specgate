Feature: The areas adopt finds are not requirements

  @REQ-471 @SCN-471a
  Scenario: Four areas found in an existing project
    Given a local project with code under `src/auth`, `src/catalog`, `src/orders` and `src/payments`, and tests under `test/auth`
    When the developer adopts it
    Then `docs/specs/adoption.md` lists the four areas with their folders, file counts and `test/auth/auth.test.js` under Auth, the matrix has only REQ-001, and `status` shows one requirement
