Feature: A check may reach Docker, for tests that start containers

  @REQ-238 @SCN-238a
  Scenario: Spring Boot tests with Testcontainers
    Given a `pom.xml` that declares `org.testcontainers`
    When the coverage check's container command line is built
    Then it mounts `/var/run/docker.sock` and sets `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`, and a check without `docker: true` mounts no socket
