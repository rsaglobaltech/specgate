Feature: Every refusal says the fix in one line

  @REQ-113 @SCN-113a
  Scenario: One fix line, human and JSON
    Given a project where `specgate archive add-dynamic-pricing` is refused because REQ-003 is pending
    When the developer runs it once plainly and once with `--json`
    Then the plain output's last line is the only line starting with `fix:`, and the JSON diagnostic's `fix` holds the same text on one line
