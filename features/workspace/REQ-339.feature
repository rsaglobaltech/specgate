Feature: The workspace repository takes the client's brief

  @REQ-339 @SCN-339a
  Scenario: The brief saved at the root
    Given a workspace of fleet and tracking whose repository holds the client's `brief.md`
    When the developer runs `specgate workspace draft`, writes `stories: [{ id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }]` in its front matter and runs it again
    Then `docs/brief.md` holds the brief's text below a front matter, and the second run lists follow-shipment with fleet and tracking
