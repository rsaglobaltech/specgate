Feature: A ticket is read into its parts

  @REQ-145 @SCN-145a
  Scenario: A story as the analyst wrote it
    Given an exported KAN-18 whose description holds an "As an administrator…" paragraph, a "Source: Spec §2.2" line, five criteria under "Acceptance Criteria" and one question under "Open questions"
    When the developer runs `specgate propose --from-ticket KAN-18.json --check --json`
    Then the ticket reads with key KAN-18, type Story, five criteria, one question, intent beginning "As an administrator" and source "Spec §2.2"

  @REQ-145 @SCN-145b
  Scenario: German headings
    Given an exported story whose description has "Akzeptanzkriterien:" and "Offene Fragen" sections
    When the developer runs `specgate propose --from-ticket story.json --check --json`
    Then the criteria and the questions are read from those sections
