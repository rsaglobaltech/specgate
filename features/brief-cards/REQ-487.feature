Feature: The form written back, every other byte kept

  @REQ-487 @SCN-487a
  Scenario: A CRLF brief with notes after its last module
    Given a docs/brief.md written with CRLF, with a `## Context` section, the modules orders and payments, and two blank lines and a note after payments' section
    When its form is read, a rule is added to orders, and the form is written back
    Then the brief has the new rule under orders, every line still ends in CRLF, and every byte outside orders' section is as it was; written back with no change, the file is identical byte for byte
