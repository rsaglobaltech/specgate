Feature: Adopt one area of a large system

  @REQ-337 @SCN-337a
  Scenario: The billing area only
    Given a repository with src/billing/invoices, src/billing/payments and src/shipping/routes, each holding source files
    When the developer runs `specgate adopt --scope src/billing`
    Then spec.md proposes invoices and payments, not routes, names src/billing as the scope, and features/adoption/baseline.feature names src/billing
