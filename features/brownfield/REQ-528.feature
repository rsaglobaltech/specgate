Feature: reverse lists the modules of an existing system

  @REQ-528 @SCN-528a
  Scenario: A Maven project with two modules
    Given a git project whose `pom.xml` declares the modules `orders` and `billing`, each with Java sources
    When a tool runs `specgate reverse --modules --json`
    Then it exits 0 and `modules` lists `billing` then `orders`, each with `stack` `java` and its file count, and no agent was started
