Feature: More validations by default

  @REQ-458 @SCN-458a
  Scenario: The ids compared with the base branch
    Given a project whose main branch is `main`
    When `specgate ci init --provider github` writes its gate
    Then the checkout uses `fetch-depth: 0` and the gate runs `check --base origin/main` on `ubuntu-latest`, `macos-latest` and `windows-latest`
