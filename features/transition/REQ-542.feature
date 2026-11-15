Feature: Release notes come from what was archived

  @REQ-542 @SCN-542a
  Scenario: One enhancement and one bug between two tags
    Given a repository where the change `pdf-invoices` (kind `enhancement`, REQ-007) and the change `rounding` (kind `bug`, REQ-009) were archived between the tags `v1.0.0` and `v1.1.0`
    When a tool runs `specgate release-notes v1.0.0..v1.1.0`
    Then the output has an `Enhancements` section with `pdf-invoices` and REQ-007's title, then a `Fixes` section with `rounding` and REQ-009's title
