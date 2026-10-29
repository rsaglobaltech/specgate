Feature: An agent drafts a story, and writes nothing else

  @REQ-340 @SCN-340a
  Scenario: The agent writes the story and touches the brief
    Given the workspace above with follow-shipment in its brief's front matter, and an agent that writes the story's intent and AC-1 and also edits `docs/brief.md`
    When the developer runs `specgate workspace draft follow-shipment --agent …`
    Then `docs/stories/follow-shipment/story.md` holds the intent and AC-1, the prompt carried the brief, and `docs/brief.md` is as it was
