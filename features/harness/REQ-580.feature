Feature: A value put in a command is one argument

  @REQ-580 @SCN-580a
  Scenario: A feature path with a space
    Given a requirement whose feature file is `features/the shop/REQ-007.feature`
    When the test command `npx cucumber-js {feature_file}` is resolved
    Then the path is one argument, and `{req}` alone is left as `REQ-007`
