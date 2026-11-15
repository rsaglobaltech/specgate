Feature: A reversed module is a layered change

  @REQ-561 @SCN-561a
  Scenario: A reversed module is a layered change
    Given a Maven project whose module `orders` an agent reads into two requirements
    When a developer runs `specgate reverse orders`
    Then the change has discover.md, design.md and tasks.md naming both requirements, `schema: layered`, no proposal.md, and `change validate --strict` passes
