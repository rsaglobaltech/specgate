Feature: A German or accented summary makes a readable change id

  @REQ-161 @SCN-161a
  Scenario: "Groß" becomes "gross" in the change id
    Given the exported PET-101 with the summary "Suche ignoriert Groß-/Kleinschreibung nicht"
    When the developer runs `specgate propose --from-ticket PET-101.json --capability owners --no-branch`
    Then the change is `pet-101-suche-ignoriert-gross-kleinschreibung-nicht`
