Feature: The report says what was built and how it was proven

  @REQ-217 @SCN-217a
  Scenario: The report of a project half built
    Given a module with two requirements Implemented and one waiting for an answer
    When the report is read
    Then it counts 2 built of 3, lists both with their scenario, and names the one waiting with its question

  @REQ-217 @SCN-217b
  Scenario: The report downloads
    Given studio is running
    When the report's download is opened
    Then it is an HTML page that names the project and needs nothing else to open
