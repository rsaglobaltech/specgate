Feature: Each repository's harness, seen from the workspace

  @REQ-320 @SCN-320a
  Scenario: Tracking is on a quality check, fleet is idle
    Given a workspace of fleet and tracking, and tracking's harness on REQ-005 with the gate step "quality: semgrep" started in Docker after its agent edited TrackingController.java
    When the developer runs `specgate workspace live --json`
    Then tracking's panel shows REQ-005 in flight on "quality: semgrep" in docker with the agent's last step an edit of TrackingController.java, and fleet's panel shows nothing in flight
