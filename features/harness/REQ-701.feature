@change:sandbox-swarm
Feature: No sandbox left behind unseen

  @REQ-701 @SCN-701a
  Scenario: One left behind, one stray
    Given `sg-old-pagos` recorded for a change already archived, `sg-stray` existing and unrecorded, and `sg-draft-katalog-katalog` of an open change
    When the Developer runs `specgate harness sandboxes --prune`
    Then `sg-old-pagos` and `sg-stray` are removed, and `sg-draft-katalog-katalog` stays
