Feature: A reused process number does not keep a lock

  @REQ-593 @SCN-593a
  Scenario: The number of a crashed run, taken by another program
    Given a run lock written an hour ago naming a process number that a program started a moment ago now holds
    When a new run asks for the lock
    Then it takes it, and the lock it writes names its own process
