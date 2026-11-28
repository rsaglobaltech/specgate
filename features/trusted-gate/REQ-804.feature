Feature: A delivery keeps its after beside its before

  @REQ-804 @SCN-804a
  Scenario: Delivered after its before
    Given REQ-031 with a before
    When `specgate apply REQ-031` delivers it with its scenarios green
    Then `.specgate/evidence/REQ-031/evidence.json` has exit code 0 and names the before's exit code, and `before/run.json` is unchanged
