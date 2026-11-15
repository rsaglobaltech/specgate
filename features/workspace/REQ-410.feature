Feature: Each repository's live view, from the workspace

  @REQ-410 @SCN-410a
  Scenario: The dispatcher follows tracking
    Given the workspace truck-flote has fleet and tracking, and tracking's harness is on REQ-005, attempt 1, at the quality check semgrep
    When the developer opens `/live/repo/tracking/` in the workspace's studio and reads `live.json` and `live/stream` under it
    Then the page is the harness live view with the work queue and a link back to `/live`, naming tracking and its role, and the model and the first event of the stream carry REQ-005 in flight at attempt 1
