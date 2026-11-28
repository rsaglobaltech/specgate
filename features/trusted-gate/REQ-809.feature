Feature: The evidence keeps what a workspace's runner wrote

  @REQ-809 @SCN-809a
  Scenario: A screenshot in a workspace
    Given a project whose `package.json` declares the workspace `apps/*`, and a `bdd_cmd` that writes `apps/web/test-results/flow/test-finished-1.png`
    When the Developer runs `specgate evidence before REQ-001`
    Then `.specgate/evidence/REQ-001/before/artifacts/apps/web/flow/test-finished-1.png` exists, and `run.json` lists it
