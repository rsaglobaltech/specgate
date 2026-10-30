Feature: A part is written after the contracts it uses

  @REQ-395 @SCN-395a
  Scenario: Tracking's design waits for the contracts
    Given the story track-fleet gives AC-1 to contracts and to tracking, and contracts' part has no requirement
    When the developer runs `specgate change author track-fleet --artifact design` in tracking
    Then it fails with `author_contracts_first`, naming contracts and `--force`; with `--force` it writes, and once contracts' part has a requirement it writes without it
