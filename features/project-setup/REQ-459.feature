Feature: A minimal gate, for those who want one

  @REQ-459 @SCN-459a
  Scenario: One step
    Given a project with no CI file
    When `specgate ci init --provider github --minimal` runs
    Then `.github/workflows/spec-gate.yml` has one job on `ubuntu-latest` whose only specgate step is `check`
