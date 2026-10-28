Feature: The tests run the lines a change touched

  @REQ-223 @SCN-223a
  Scenario: Below the threshold, the uncovered lines are named
    Given `diff_coverage: 80`, a change that adds five executable lines to src/a.js, and an LCOV report where a test ran three of them
    When the check runs
    Then it fails with 60%, naming the two lines no test ran

  @REQ-223 @SCN-223b
  Scenario: JaCoCo's package paths match the repository's
    Given a change to src/main/java/com/shop/Order.java and a JaCoCo report of com/shop/Order.java where every changed line ran
    When the check runs
    Then it passes with 100%
