@change:sandbox-swarm
Feature: The agent in its module's sandbox

  @REQ-698 @SCN-698a
  Scenario: Two requirements of ausleihe, one sandbox
    Given `sandbox: { engine: sbx, kit: opencode, setup: "install-node" }`, and REQ-006 and REQ-007 of ausleihe in change draft-ausleihe pending
    When the Developer runs `specgate harness run --req REQ-006 --req REQ-007`
    Then one sandbox `sg-draft-ausleihe-ausleihe` was created, `install-node` ran in it once, both agents ran in it in their worktrees, and `.harness/sandboxes.json` records it
