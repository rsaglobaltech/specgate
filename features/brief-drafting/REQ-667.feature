Feature: A brief's language becomes the project's

  @REQ-667 @SCN-667a
  Scenario: A Spanish brief, no language set
    Given a project with no `language` and a brief written in Spanish
    When the Developer runs `specgate propose --from-brief pedidos`
    Then `.specgate/config.json` holds `language: es`, and DRAFTING.md asks for the scenarios' steps in Spanish
