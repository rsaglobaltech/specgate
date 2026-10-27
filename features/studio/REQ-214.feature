Feature: The brief is written as a form

  @REQ-214 @SCN-214a
  Scenario: A form round trip
    Given a brief with two modules, one of them with prose under its heading
    When it is read as a form, a rule is added to one module, and the form is saved
    Then the brief has the new rule, the other module's cards and the prose are unchanged, and the front matter lists both modules

  @REQ-214 @SCN-214b
  Scenario: The findings come back with the save
    Given a module with rules and no example
    When the form is saved
    Then a finding names that module as having no example
