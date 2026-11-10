Feature: After adoption, onboard points at one behaviour, not a folder

  @REQ-477 @SCN-477a
  Scenario: onboard on an adopted project with areas
    Given a project adopted with the areas Billing and Invoices
    When the developer runs `specgate onboard --json`
    Then its next command is `specgate new "<a behaviour you rely on>"`, not `specgate propose describe-billing`
