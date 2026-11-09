Feature: A studio already running is found, not fought

  @REQ-445 @SCN-445a
  Scenario: The same project's studio is already running
    Given a studio of the project serving on port 4173
    When specgate studio is run again in that project
    Then it says a studio of this project is already running at http://localhost:4173 with that studio's process id, ends with exit code 0, and starts no second server
