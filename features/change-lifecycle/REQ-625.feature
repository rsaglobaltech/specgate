@change:use-cases-lifecycle
Feature: A change carries its use cases, and archive merges them into the catalog

  @REQ-625 @SCN-625a
  Scenario: A use case added
    Given a change adding UC-007 "Price a session at peak time" for Driver with REQ-001, and a catalog holding the template's row and UC-002
    When the Developer archives it
    Then docs/specs/use-cases.md has UC-007 with REQ-001 and Approved, still UC-002, and no template row; the plan lists the catalog among its writes

  @REQ-625 @SCN-625b
  Scenario: A use case modified
    Given UC-003 in the catalog with its command, aggregate and events, and a change modifying UC-003's name and requirements
    When the change is archived
    Then UC-003's row has its new name and requirements, and the same command, aggregate and events

  @REQ-625 @SCN-625c
  Scenario: A use case removed while a requirement names it
    Given UC-002 named by REQ-000, and a change removing UC-002
    When the Developer archives it
    Then the archive is refused with `uc_removed_in_use` naming REQ-000, and the catalog is untouched
