Feature: A requirement's brief quote is in the brief

  @REQ-799 @SCN-799a
  Scenario: A quote the brief never wrote
    Given a brief that says "A member recovers access with their email." and REQ-011 quoting `> Brief: "Access is never recovered."`
    When the draft is checked
    Then `D17_quote_not_in_brief` names REQ-011 at the quote's line

  @REQ-799 @SCN-799b
  Scenario: The brief's sentence, wrapped and quoted
    Given the same brief, its sentence wrapped over two lines, and REQ-011 quoting `> Brief: "A member *recovers* access with their email"`
    When the draft is checked
    Then no `D17_quote_not_in_brief` is reported
