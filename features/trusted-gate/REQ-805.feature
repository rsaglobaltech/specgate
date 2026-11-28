Feature: Doctor says when the runner keeps no pictures

  @REQ-805 @SCN-805a
  Scenario: Playwright without screenshots
    Given `bdd_cmd` runs `npx bddgen && npx playwright test`, and `playwright.config.ts` with no `screenshot:` under `use`
    When the Developer runs `specgate doctor`
    Then it warns `doctor_evidence_media`, its fix naming `screenshot: 'on'` and `video: 'on'`
