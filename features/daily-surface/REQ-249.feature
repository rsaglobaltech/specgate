Feature: init --yes where code exists says what it does

  @REQ-249 @SCN-249a
  Scenario: A package.json and --yes
    Given a folder with `package.json`
    When `specgate init --yes --dry-run` runs
    Then it warns that it scaffolds a separate project and names `specgate init` without `--yes` to adopt the folder
