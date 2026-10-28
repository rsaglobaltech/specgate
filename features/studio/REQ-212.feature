Feature: The route says where the project is

  @REQ-212 @SCN-212a
  Scenario: A project with a brief and no draft
    Given a project with a brief of three modules and no draft
    When the route is read
    Then Project and Brief are done, Drafts is current with "0 of 3", Build and Report are locked, and the next action is to draft the first module

  @REQ-212 @SCN-212b
  Scenario: A folder that is not a project
    Given a folder with no specgate project
    When the route is read
    Then Project is current and every other step is locked
