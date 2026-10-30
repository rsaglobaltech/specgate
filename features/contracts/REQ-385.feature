Feature: A contract is written one requirement at a time

  @REQ-385 @SCN-385a
  Scenario: The contracts repository delivers its first operation
    Given openapi.yaml has `reportPosition`, REQ-001 cites it, and REQ-002 and REQ-003, still Draft, cite asyncapi.yaml, not written yet
    When the developer runs `specgate validate . --strict --json`
    Then it passes with two `api_contract_missing` warnings saying they must resolve once delivered, and delivering REQ-002 holds REQ-002's citation as an error

  @REQ-385 @SCN-385b
  Scenario: Delivered, its contract still missing
    Given REQ-002 is Implemented and cites asyncapi.yaml, which does not exist
    When the developer runs `specgate validate . --strict --json`
    Then it fails with `api_contract_missing` as an error for REQ-002
