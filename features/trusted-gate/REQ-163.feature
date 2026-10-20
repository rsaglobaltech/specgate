Feature: A ticket's change sees the branches pushed meanwhile

  @REQ-163 @SCN-163a
  Scenario: A colleague pushed a ticket branch a minute ago
    Given a clone whose `origin` has a branch `feature/PET-104-walk-in` this clone has never fetched, holding a change that reserves REQ-010
    When the developer runs `specgate propose --from-ticket PET-103.json --capability owners`
    Then PET-103's change reserves ids above REQ-010
