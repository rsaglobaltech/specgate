Feature: A module from a workshop is drafted from its model

  @REQ-656 @SCN-656a
  Scenario: The siniestros module drafted
    Given the claims workshop imported
    When the Developer runs `specgate propose --from-brief siniestros`
    Then the draft's DRAFTING.md names `docs/brief/models/siniestros.yaml` as a source, and a scenario stating "75 %" passes D6 because the model says it
