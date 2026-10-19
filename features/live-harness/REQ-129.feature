Feature: Claude Code's steps become events

  @REQ-129 @SCN-129a
  Scenario: A read, an edit and a test run
    Given a stream with a Read of src/a.ts, an Edit of src/a.ts and a Bash call running `npm test`, each with its result, and a final result "Done."
    When it is piped into `specgate harness events --from claude` with `AGENT_EVENTS_FILE` set
    Then the file gains three step lines with kinds read, edit and test and targets "src/a.ts", "src/a.ts" and "npm test", and standard output is "Done."
