Feature: Each module is drafted from the studio

  @REQ-216 @SCN-216a
  Scenario: Starting a draft
    Given a brief with a module `reservas` not started
    When its drafting is started with the profile `fast`
    Then a run of `propose --from-brief reservas --profile fast` is working, and the module reads as being drafted

  @REQ-216 @SCN-216b
  Scenario: One draft at a time
    Given a module being drafted
    When another is started
    Then it is refused naming the module in progress
