Feature: A clone registers the merge drivers alone

  @REQ-172 @SCN-172a
  Scenario: A developer's fresh clone
    Given a clone whose committed `.gitattributes` routes the capability specs and the matrix to the drivers, with a committed `harness.config.yaml`, and no driver in its git config
    When the developer runs `specgate harness init --merge-drivers`
    Then `merge.specgate-spec.driver` and `merge.specgate-matrix.driver` are set in its git config, and `git status --porcelain` is empty
