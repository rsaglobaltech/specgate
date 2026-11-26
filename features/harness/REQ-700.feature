Feature: Archive removes the change's sandboxes

  @REQ-700 @SCN-700a
  Scenario: draft-ausleihe archived
    Given `sg-draft-ausleihe-ausleihe` recorded for draft-ausleihe with 2 rules, and `sg-draft-katalog-katalog` for draft-katalog
    When the Developer runs `specgate archive draft-ausleihe`
    Then `sg-draft-ausleihe-ausleihe` and its 2 rules are removed, and `sg-draft-katalog-katalog` stays recorded
