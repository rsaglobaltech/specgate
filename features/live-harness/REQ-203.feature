Feature: Every open question, answered from the live view

  @REQ-203 @SCN-203a
  Scenario: Open questions in the live view
    Given draft-examen's Q6 is open and REQ-031 is Needs Clarification with no question
    When the live model is read and the page served
    Then the model holds Q6 with its change, text and blocks, and REQ-031 as waiting, and the page lists them under Open questions with an answer form for Q6
