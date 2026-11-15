Feature: A person classifies a requirement's gap

  @REQ-300 @SCN-300a
  Scenario: Classifying a requirement
    Given a project whose ledger records REQ-002
    When the person runs `harness report --classify REQ-002 --gap intent-spec --reason "the brief never said a truck can carry two drivers"`
    Then `.harness/gaps.jsonl` holds that classification and the report counts REQ-002 as intent → spec, marked by a person

  @REQ-300 @SCN-300b
  Scenario: A classification without a reason
    Given the same project
    When the person runs `harness report --classify REQ-002 --gap spec-impl` with no `--reason`
    Then the command fails naming `--reason`, and nothing is written
