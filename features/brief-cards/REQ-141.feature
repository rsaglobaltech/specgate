Feature: The agent proposes the cards from pasted notes

  @REQ-141 @SCN-141a
  Scenario: Sections added below the notes
    Given a Lingo brief with a complete front matter and plain notes, and an agent command that appends a courses section and a lessons section
    When the developer runs `specgate propose --from-brief --agent` with that command
    Then the brief keeps the notes and gains both sections, and the output names `specgate propose --from-brief --check` as next

  @REQ-141 @SCN-141b
  Scenario: A line of the notes rewritten
    Given the same brief, and an agent command that rewrites the line "A teacher runs small groups of adult students."
    When the developer runs `specgate propose --from-brief --agent` with that command
    Then it exits 1 with `draft_brief_text_lost`, and the brief is byte for byte as before
