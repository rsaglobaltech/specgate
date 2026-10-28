Feature: The presets run for real

  @REQ-230 @SCN-230a
  Scenario: A Maven change judged by the strict preset in Docker
    Given the fixture with a baseline taken, and a change adding Discount.java with a String compared with ==, a branch no test runs, and one test
    When `specgate quality run` runs
    Then spotbugs fails on Discount.java:5 only, coverage fails naming the untested lines, mutation fails naming survivors on Discount.java, and pmd and semgrep pass

  @REQ-230 @SCN-230b
  Scenario: A Gradle change judged by the basic preset in Docker
    Given the Gradle fixture, with JaCoCo applied and dependency locking on, and a change adding Discount.java without a test
    When the attempt checks run
    Then commits and secrets pass and coverage fails at 0%, naming only lines of Discount.java

  @REQ-230 @SCN-230c
  Scenario: A Node change judged by the basic preset in Docker
    Given the Node fixture with TypeScript, Vitest and its coverage provider, and a change adding src/discount.ts without a test
    When the attempt checks run
    Then types pass and coverage fails, naming lines of src/discount.ts
