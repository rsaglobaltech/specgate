Feature: A ticket is checked against a Definition of Ready

  @REQ-146 @SCN-146a
  Scenario: A ticket with no criteria
    Given an exported story whose description is one "As a user…" paragraph
    When the developer runs `specgate propose --from-ticket story.json --check`
    Then it exits 1, shows `T1_no_criteria` with a fix naming the "Acceptance Criteria" heading, and `git status` shows no change

  @REQ-146 @SCN-146b
  Scenario: A criterion that prescribes tests
    Given the exported KAN-18, whose fourth criterion reads "when unit tests run, then they cover at least: 0 minutes, exactly 1 hour…"
    When the developer runs `specgate propose --from-ticket KAN-18.json --check`
    Then it exits 0, shows `T6_test_instruction` for criterion 4, and says "Ready to draft"

  @REQ-146 @SCN-146c
  Scenario: Vague words in German
    Given an exported story with the criterion "Die Liste lädt schnell und ist benutzerfreundlich"
    When the developer runs `specgate propose --from-ticket story.json --check`
    Then it exits 1 and shows `T2_vague` naming "schnell" and "benutzerfreundlich"

  @REQ-146 @SCN-146d
  Scenario: A design deliverable
    Given an exported story whose criteria read "when user flows are delivered, then they cover login" and "when they are reviewed, then the product owner approves them"
    When the developer runs `specgate propose --from-ticket story.json --check`
    Then it shows `T7_not_behaviour`, whose fix says a deliverable is tracked on the board, not specified
