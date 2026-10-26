Feature: One harness run per working copy

  @REQ-186 @SCN-186a
  Scenario: A second run is refused
    Given a harness run holds the working copy
    When another run tries to take it
    Then it is refused, and once released no lock remains

  @REQ-186 @SCN-186b
  Scenario: A stale lock does not block
    Given a lock left by a process that no longer exists
    When a run starts
    Then it takes the working copy
