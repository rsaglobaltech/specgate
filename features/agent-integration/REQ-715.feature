Feature: A cell's verdict

  @REQ-715 @SCN-715a
  Scenario: Two of three
    Given codex at L1 with three runs, two passing both checks
    When the matrix is made
    Then codex at L1 is amber, 2/3
