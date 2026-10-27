Feature: Answering a question from the live view

  @REQ-201 @SCN-201a
  Scenario: A write needs the token, JSON and a loopback origin
    Given studio's token
    When a write comes without it, with another, as a form, or from another site
    Then it is refused

  @REQ-201 @SCN-201b
  Scenario: The live page answers and marks reviewed
    Given draft-examen's Q6 is open and studio is running
    When the page posts an answer to Q6 with its token, then marks it reviewed
    Then Q6 is answered, A1 is added and then decided, a post without the token is refused with 403 and a PUT with 405

  @REQ-201 @SCN-201c
  Scenario: The form is under the question
    Given the live page
    When it is served
    Then Needs attention has the answer form that posts to live/answer with the token, and the token in the page is only hex
