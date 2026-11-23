@change:bdd-gate
Feature: New, adopted and migrated projects run their scenarios

  @REQ-663 @SCN-663c
  Scenario: A new project with no runner
    Given a Node project with no `test:bdd` script and no Playwright or Cucumber
    When the Developer runs `specgate init`
    Then gate.yaml does not say `bdd: required`, `specgate check` warns `bdd_not_set_up` with `specgate migrate bdd`, and `specgate apply` delivers a requirement whose test passes

  @REQ-663 @SCN-663d
  Scenario: A new project with its own test:bdd script
    Given a Node project whose package.json has the script `test:bdd`
    When the Developer runs `specgate init`
    Then gate.yaml says `bdd: required` and harness.config.yaml's `bdd_cmd` is `npm run test:bdd --silent -- --grep "{tags}"`

  @REQ-663 @SCN-663b
  Scenario: A project with its own test:bdd script
    Given a project whose package.json has the script `test:bdd`
    When the Developer runs `specgate migrate bdd`
    Then harness.config.yaml's `bdd_cmd` is `npm run test:bdd --silent -- --grep "{tags}"`

  @REQ-663 @SCN-663a
  Scenario: A web project migrated
    Given a project with `apps/web/package.json` depending on `@playwright/test` and no `bdd` in its gate.yaml
    When the Developer runs `specgate migrate bdd`
    Then gate.yaml says `bdd: required` and harness.config.yaml's `bdd_cmd` is `npx bddgen && npx playwright test --grep "{tags}"`
