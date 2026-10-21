Feature: A ticket's branch may name its team

  @REQ-170 @SCN-170a
  Scenario: A team's branch is still the ticket's
    Given a branch `feature/parking/KAN-13` with a commit "KAN-13 REQ-151: normalize plates" and a commit "fix typo"
    When the developer runs `specgate check`
    Then it warns `ticket_key_missing` for "fix typo" only
