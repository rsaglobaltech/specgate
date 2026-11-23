Feature: Apply keeps the evidence of each delivery

  @REQ-680 @SCN-680a
  Scenario: Delivered, with its screenshot
    Given a project with `bdd: required` and a `bdd_cmd` that passes for `@REQ-031` and writes `test-results/cancel/screenshot.png`
    When the Developer runs `specgate apply REQ-031`
    Then `.specgate/evidence/REQ-031/evidence.json` names the command with exit code 0, `bdd.log` holds its output, `artifacts/cancel/screenshot.png` exists, and `.specgate/evidence/.gitignore` ignores `artifacts/`
