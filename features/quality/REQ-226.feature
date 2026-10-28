Feature: SonarQube Community in Docker, without an account

  @REQ-226 @SCN-226a
  Scenario: SonarQube's issues as SARIF
    Given two SonarQube issues, one BLOCKER on line 5 of src/main/java/com/shop/Repo.java with a line hash, one MINOR without a line
    When they are written as SARIF
    Then they are an error and a note, in the repository's paths, the first fingerprinted by its hash

  @REQ-226 @SCN-226b
  Scenario: What the scanner is told
    Given a Maven project with src/main/java, src/test/java and target/classes, and a Node project with neither
    When their scanner properties are built
    Then the first names the Java sources, tests and classes, the second the whole folder without node_modules, dist, coverage or .specgate

  @REQ-226 @SCN-226c
  Scenario: A real analysis judged against the baseline
    Given SPECGATE_TEST_SONAR set and Docker answering, the Maven fixture with its baseline taken by the sonar check, and a change comparing Strings with ==
    When the end checks run
    Then sonar fails on Discount.java:5 only, the fixture's own issues held back
