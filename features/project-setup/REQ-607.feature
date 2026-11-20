Feature: An undecided stack names the way to decide it

  @REQ-607 @SCN-607a
  Scenario: Adopted with no code
    Given an empty folder
    When the developer runs `specgate adopt`, then `specgate status` and `specgate doctor`
    Then `AGENTS.md` says `Stack: TBD` and `Testing: TBD` and names `specgate config set stack` and `specgate init --forja`, and both commands print `specgate config set stack "<yours>"`

  @REQ-607 @SCN-607b
  Scenario: The person decides
    Given that project, with a line `Stack: do not touch this line` the team wrote below Specgate's block
    When the developer runs `specgate config set stack "a · b"`, then `specgate config set stack Go` and `specgate config set testing "go test"`
    Then the first exits 2 with `config_value_invalid`, the header says `Stack: Go` and `Testing: go test`, the team's line is as it was, and `status` and `doctor` no longer mention the stack

  @REQ-607 @SCN-607c
  Scenario: A stack read from the project
    Given a folder with a `package.json`
    When the developer runs `specgate adopt`
    Then `AGENTS.md` states the stack it read, and `status` and `doctor` say nothing about deciding it
