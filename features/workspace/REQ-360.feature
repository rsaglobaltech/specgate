Feature: An agent proposes the stories of the brief

  @REQ-360 @SCN-360a
  Scenario: The agent names follow-shipment
    Given a workspace whose brief names no story, and an agent that writes a `stories:` entry and also edits the brief's text
    When the developer runs `specgate workspace draft --agent "<cmd>"`
    Then the front matter names follow-shipment with its repositories, the client's text is as before, and a second `workspace draft --agent` without a story id is refused
