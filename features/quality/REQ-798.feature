Feature: A trace value cut at a space is reported, and read alike everywhere

  @REQ-798 @SCN-798a
  Scenario: An unquoted actor with a space
    Given a requirement whose trace says `actor=Adulto responsable kind=functional`
    When `specgate validate` runs
    Then it warns that `actor=Adulto responsable` is read as `actor=Adulto`, and to write `actor="Adulto responsable"`

  @REQ-798 @SCN-798b
  Scenario: A quoted actor
    Given a requirement whose trace says `actor="Adulto responsable"`
    When the domain view and the actors diagram read it
    Then its actor is `Adulto responsable`, and `specgate validate` warns about nothing in it
