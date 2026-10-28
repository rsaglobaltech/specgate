Feature: Docker counts only when it runs Linux containers

  @REQ-254 @SCN-254a
  Scenario: Docker Desktop on Windows containers
    Given a Docker server that reports `windows` as its operating system
    When a check that runs in Docker is resolved
    Then it is skipped, saying to switch Docker Desktop to Linux containers, and no image is pulled
