Feature: A merge driver that is gone falls back to git's own merge

  @REQ-169 @SCN-169a
  Scenario: The copy of specgate the driver ran is gone
    Given a repository where `specgate harness init` registered the merge drivers, and the specgate copy they run has since been removed
    When a branch that rewrote a line of a capability spec is merged into one that rewrote the same line differently
    Then the merge stops with git's conflict markers around that line, holding both texts, and stderr says the merge driver is missing

  @REQ-169 @SCN-169b
  Scenario: Doctor names the missing driver
    Given the same repository
    When the developer runs `specgate doctor`
    Then it warns that the spec merge driver points at a file that does not exist
