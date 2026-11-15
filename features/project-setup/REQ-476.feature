Feature: Folders named by the kind of code are not areas

  @REQ-476 @SCN-476a
  Scenario: A React CLI split by kind of code
    Given a TypeScript project whose `src/` holds `components`, `keymap`, `hooks`, `utils` and `data`
    When the developer runs `specgate onboard`, then `specgate adopt --yes`
    Then `onboard` proposes no area and says the code is organised by kind, `adopt` writes no `docs/specs/adoption.md`, and spec.md has REQ-001 alone

  @REQ-476 @SCN-476b
  Scenario: Areas beside a utils folder
    Given a project whose `src/` holds `billing`, `invoices` and `utils`
    When the developer runs `specgate onboard`
    Then it proposes the areas Billing and Invoices, and not Utils
