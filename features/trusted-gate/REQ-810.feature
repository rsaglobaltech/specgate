Feature: Doctor sees a workspace's runner and its Playwright config

  @REQ-810 @SCN-810a
  Scenario: playwright-bdd in a workspace
    Given a project with `bdd_cmd: npm run test:bdd -- --grep "{tags}"`, the workspace `apps/web` whose `playwright.config.ts` uses playwright-bdd with no `screenshot` or `video`, and a well-formed feature file
    When the Developer runs `specgate doctor`
    Then the scenarios line does not say "no Gherkin runner", and `doctor_evidence_media` is reported
