Feature: The live view groups by module and keeps its header in view

  @REQ-181 @SCN-181a
  Scenario: A sticky header, modules that fold, and the requirement's tabs
    Given the live page
    When it is served
    Then its header and summary are sticky, its modules fold, and the requirement has its tabs

  @REQ-181 @SCN-181b
  Scenario: The traceability matrix as it stands
    Given a capability spec with a delivered requirement and an open change with a draft one
    When the live matrix is read
    Then both are rows, the first from the spec and the second from the change, each with its module, tests and status

  @REQ-181 @SCN-181c
  Scenario: The run as a matrix by module
    Given the live page
    When it is served
    Then its centre is a matrix with a row per module and a segment per requirement, with a legend of passed, running, failed, blocked and queued, and no graph of jobs
