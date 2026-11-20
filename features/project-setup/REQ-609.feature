Feature: A plain init in an empty folder chooses nothing for the person

  @REQ-609 @SCN-609a
  Scenario: No terminal, no flags
    Given an empty folder and no terminal
    When `specgate init` runs, then `specgate check`
    Then init exits 0 saying `writing the specification only, in this folder` and naming `specgate init --yes` and `specgate init --forja`, `AGENTS.md` in that folder says `new project` and `Stack: TBD · API: TBD · Testing: TBD`, no `my-spec-driven-app` folder exists, and `check` exits 0

  @REQ-609 @SCN-609b
  Scenario: Every default
    Given an empty folder
    When `specgate init --yes --no-git` runs
    Then it says `the project goes in a new folder here: my-spec-driven-app/`, warns `--yes took every default: a backend project on Java 21`, names `specgate config set stack`, ends with `cd my-spec-driven-app && specgate status`, and `my-spec-driven-app/spec.md` exists

  @REQ-609 @SCN-609c
  Scenario: The three answers
    Given the question `What are you starting?`
    When the person answers nothing, `2`, `1`, `3` and `4`
    Then the starts are the specification only, the specification only, forja, a template, and the question again
