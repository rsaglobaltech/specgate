@change:sealed-acceptance
Feature: A person approves a change's acceptance tests

  @REQ-757 @SCN-757a
  Scenario: Sealed as they are
    Given export-csv with its design approved and an `acceptance.md` listing `tests/acceptance/export.spec.ts — SCN-120a`
    When a person runs `specgate change approve export-csv --layer acceptance` at a terminal
    Then the change's approvals hold the layer `acceptance` with the sha256 of `tests/acceptance/export.spec.ts`

  @REQ-757 @SCN-757b
  Scenario: A test that proves no scenario
    Given the same change, and a line of `acceptance.md` naming `SCN-999z`, which its delta does not have
    When a person approves its acceptance
    Then it fails naming the line and `SCN-999z`, and no acceptance approval is recorded

  @REQ-757 @SCN-757c
  Scenario: Any language
    Given a Maven project whose `acceptance.md` lists `src/test/java/shop/FeesAcceptanceIT.java — SCN-130a`
    When a person approves its acceptance
    Then the file is sealed the same way
