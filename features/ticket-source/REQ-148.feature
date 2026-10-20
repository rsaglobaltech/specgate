Feature: The ticket key travels with the work

  @REQ-148 @SCN-148a
  Scenario: A story becomes a branch
    Given a clean git repository and the exported KAN-13, of type Story
    When the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
    Then the current branch is `feature/KAN-13-register-vehicle-entry`

  @REQ-148 @SCN-148b
  Scenario: A commit without the key
    Given that branch with one commit "KAN-13 REQ-151: normalize plates" and one commit "fix typo"
    When the developer runs `specgate check`
    Then it warns `ticket_key_missing` for "fix typo" only

  @REQ-148 @SCN-148c
  Scenario: The analyst changed a criterion
    Given the opened change, and an exported KAN-13 whose second criterion now ends "pre-filled with the current time"
    When the developer runs `specgate propose --from-ticket KAN-13.json --check`
    Then it reports `ticket_changed` showing the old and the new line

  @REQ-148 @SCN-148d
  Scenario: The branch is on the host as soon as work starts
    Given a clean git repository whose `origin` is reachable, and the exported KAN-13
    When the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
    Then `origin` has the branch `feature/KAN-13-register-vehicle-entry`, and the local branch tracks it

  @REQ-148 @SCN-148e
  Scenario: Gitflow: the ticket's branch starts from develop
    Given a clone whose remote's default branch is `main`, where the developer is on `develop`, which has commits `main` lacks, and `alm.config.yaml` names `pr.base: develop`
    When the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
    Then the branch `feature/KAN-13-register-vehicle-entry` starts from `develop`, and `specgate check` on it warns `ticket_key_missing` for none of `develop`'s commits
