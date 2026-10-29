Feature: init --yes where code exists adopts it

  @REQ-249 @SCN-249a
  Scenario: A package.json and --yes
    Given a folder with `package.json`
    When `specgate init --yes --dry-run` runs
    Then it says it adopts the folder in place and writes no sub-folder project

  @REQ-249 @SCN-249b
  Scenario: --new still scaffolds
    Given a folder with `package.json`
    When `specgate init --yes --new --dry-run` runs
    Then it scaffolds a separate project, as before
