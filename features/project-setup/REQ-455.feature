Feature: init installs the full gate, not specs.yml

  @REQ-455 @SCN-455a
  Scenario: A new Node project gets the gate
    Given an empty folder and specgate 0.31.0
    When `specgate init --yes` creates a Node project there
    Then `.github/workflows/spec-gate.yml` exists, runs `npx @rsaglobaltech/specgate@0.31.0 check`, and `.github/workflows/specs.yml` does not exist
