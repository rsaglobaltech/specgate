Feature: A live view in studio

  @REQ-131 @SCN-131a
  Scenario: A requirement in progress
    Given `.harness/events/REQ-002.jsonl` with an attempt start, a read, an edit of src/a.ts and a test step with 3 passing tests
    When the developer opens `/live.json` from `specgate studio`
    Then REQ-002 is listed in attempt 1, phase "test", with src/a.ts among its files and its last test run at 3 pass
    And an event appended to the file reaches `/live/stream` without a reload
