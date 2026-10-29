Feature: Docker is checked before the first attempt

  @REQ-279 @SCN-279a
  Scenario: Docker Desktop is stopped
    Given a project whose quality check runs in Docker, an agent that writes a file, and Docker not running
    When `harness run` starts
    Then it exits non-zero saying Docker is not running and to start Docker Desktop, and the agent never runs

  @REQ-279 @SCN-279b
  Scenario: A project that needs no Docker
    Given a project with no Docker check and no Testcontainers, and Docker not running
    When `harness run` starts
    Then the agent runs

  @REQ-279 @SCN-279c
  Scenario: Testcontainers cannot find Docker during the tests
    Given a test command that prints "Could not find a valid Docker environment" and exits 1, and three attempts allowed
    When `harness run` reaches the test command
    Then it makes one attempt and says the tests need Docker, without handing the failure to the agent
