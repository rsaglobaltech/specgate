@change:lab-fixes
Feature: Chaining on a branch of your own

  @REQ-694 @SCN-694a
  Scenario: On a feature branch
    Given `trust: { mitglieder: 4 }` and the branch `feature/mitglieder` checked out
    When the Developer runs `specgate harness run --chain --req REQ-002 --req REQ-003`
    Then REQ-003 is cut from REQ-002's merge on `feature/mitglieder`, and `main` is unchanged

  @REQ-694 @SCN-694b
  Scenario: On main, still refused
    Given `trust: { mitglieder: 4 }` and `main` checked out
    When the Developer runs `specgate harness run --chain`
    Then it is refused, naming a branch of your own as the fix
