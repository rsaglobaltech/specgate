Feature: Publishing a ticket's change, said and confirmed

  @REQ-448 @SCN-448a
  Scenario: Opened without pushing
    Given KAN-13 reviewed and ready on `feature/parking/KAN-13`
    When it is opened with "Don't push yet" and confirmed
    Then the command run is `propose --from-ticket KAN-13 --no-branch --no-push`, the branch holds the change's commit, and nothing was pushed
