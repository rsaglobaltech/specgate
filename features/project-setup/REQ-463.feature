Feature: The container scaffold only for a service

  @REQ-463 @SCN-463a
  Scenario: A desktop project
    Given `specgate init` with `PROJECT_TYPE: desktop`
    When the project is created
    Then it has no `.env.dev`, `docker-compose.yml`, `.dockerignore` or `.devcontainer/`, and its `runtime-environments.md` describes a local app
