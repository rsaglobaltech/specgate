Feature: The pull request carries the archived change

  @REQ-159 @SCN-159a
  Scenario: Archived before its pull request
    Given the branch `feature/KAN-13-register-vehicle-entry` whose change `kan-13-register-vehicle-entry` is archived as `2026-10-20-kan-13-register-vehicle-entry`, and a GitHub with no open pull request for it
    When the developer runs `specgate alm pr kan-13-register-vehicle-entry`
    Then one pull request is created titled "KAN-13 Register vehicle entry", whose body lists the change's requirements
