Feature: An interaction with an active prescription

  @REQ-409 @SCN-411
  Scenario: An interaction with an active prescription
    Given a patient with an active prescription and the interaction database the client has chosen
    When the physician prescribes a drug that database lists as interacting with it
    Then the response includes the interaction, its severity and its source
