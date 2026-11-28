Feature: A delta's trace value cut at a space is reported

  @REQ-825 @SCN-825a
  Scenario: An actor cut in a delta
    Given a change whose delta's trace says `actor=Product owner`
    When the Developer runs `specgate change validate triage`
    Then it warns that `actor=Product owner` is read as `actor=Product`, with `actor="Product owner"` to write, and says nothing once it is quoted
