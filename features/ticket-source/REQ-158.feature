Feature: Status points a Jira project to its tickets

  @REQ-158 @SCN-158a
  Scenario: An adopted project connected to Jira
    Given a freshly adopted project with `alm.config.yaml` naming `provider: jira`
    When the developer runs `specgate status`
    Then the next step is `specgate propose --from-ticket <KEY> --check`
