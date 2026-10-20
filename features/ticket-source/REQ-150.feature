Feature: From a Jira ticket, documented

  @REQ-150 @SCN-150a
  Scenario: The page and the help agree
    Given the documentation of this version
    When the developer reads `docs/from-a-ticket.md` and runs `specgate propose --help`
    Then the page names T1 to T9 and `cloud_id: auto`, and the help lists `--from-ticket`
