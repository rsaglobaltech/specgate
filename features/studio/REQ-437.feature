Feature: A module written under a plain heading stays one section

  @REQ-437 @SCN-437a
  Scenario: A hand-written module section is kept as the module's
    Given docs/brief.md listing modules [orders], with a "## Context" section and a "## orders" section whose prose says "Shipping is free above some amount."
    When the form is saved with the rule "An order has at least one item" for orders
    Then the brief has one "## Module: orders" section holding that prose and the rule, no "## orders" heading, and the "## Context" section unchanged
