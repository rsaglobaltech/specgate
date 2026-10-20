Feature: One pull request per ticket

  @REQ-149 @SCN-149a
  Scenario: The first pull request
    Given the branch `feature/KAN-13-register-vehicle-entry` with REQ-151 Implemented, and a GitHub with no open pull request for it
    When the developer runs `specgate alm pr kan-13-register-vehicle-entry`
    Then one pull request is created titled "KAN-13 Register vehicle entry" against `develop`, whose body names KAN-13, REQ-151 and the result of `specgate check`

  @REQ-149 @SCN-149b
  Scenario: Run again
    Given that pull request is open
    When the developer runs `specgate alm pr kan-13-register-vehicle-entry` again
    Then the same pull request is updated and no second one is created
