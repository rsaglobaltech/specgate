Feature: A requirement used on a screen needs an e2e test

  @REQ-199 @SCN-199a
  Scenario: On a screen by its surfaces or its actor's
    Given the brief gives the Fahrschüler the web and Sistema the api, and REQ-024 says surfaces=mobile
    When their surfaces are read
    Then REQ-022 of the Fahrschüler and REQ-024 are on a screen and REQ-023 of Sistema is not

  @REQ-199 @SCN-199b
  Scenario: The prompt asks for the e2e test
    Given e2e_dir is apps/web/e2e and REQ-022 is on a screen
    When its prompt is built
    Then it asks for an end-to-end test under apps/web/e2e that names REQ-022

  @REQ-199 @SCN-199c
  Scenario: The gate waits for the e2e test
    Given e2e_dir is e2e and REQ-000 is on the web
    When the agent writes only code, then also e2e/health.spec.js naming REQ-000
    Then the first run fails with "No file under e2e names REQ-000" and the second does not
