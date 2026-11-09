Feature: The API is typed, versioned, and breaks no import

  @REQ-468 @SCN-468a
  Scenario: A TypeScript program and the studio's bin lookup
    Given specgate installed in a TypeScript project with `strict` on
    When it imports `questions` and `API_VERSION` from `@rsaglobaltech/specgate/api`, and resolves `@rsaglobaltech/specgate/package.json`
    Then it compiles with no error, `API_VERSION` is `1.0.0`, and `package.json` resolves
