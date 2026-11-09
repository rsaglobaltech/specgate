Feature: The undo after an agent run keeps what it removes

  @REQ-248 @SCN-248a
  Scenario: A log edited by hand while the agent drafts
    Given `docs/notes.md` changed while an agent run writes the draft
    When the run ends and the change is undone
    Then `docs/notes.md` is back as it was before the run, its changed content is in `.git/specgate-undone/<run>/docs/notes.md`, and `git status` shows nothing new
