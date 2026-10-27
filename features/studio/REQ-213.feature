Feature: A project is created from an empty folder

  @REQ-213 @SCN-213a
  Scenario: Creating a project
    Given an empty folder
    When a project named "Autoescuela" of kind web, stack Node.js and React, agent Claude, is created
    Then the folder holds spec.md and a brief to fill, harness.config.yaml names the profile, and .harness/profiles.yaml declares it

  @REQ-213 @SCN-213b
  Scenario: A folder with files is not overwritten
    Given a folder holding a README.md
    When a project is created there
    Then it is refused with `specgate init` named, and the README.md is unchanged
