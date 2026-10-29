Feature: A layer is approved by the role that owns it

  @REQ-311 @SCN-311a
  Scenario: The architect cannot approve the business story
    Given roles naming ana@acme.eu as product and carlos@acme.eu as architect, and a change with all three layers written
    When carlos@acme.eu runs `change approve <id> --layer discover`
    Then it is refused with `approve_not_owner` naming the product role, and `--layer design` is recorded
