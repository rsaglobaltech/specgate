Feature: In spec mode the agent may change only the specification

  @REQ-523 @SCN-523a
  Scenario: The agent also edits the code
    Given a project whose agent adds a line to `spec.md`, writes a feature file under `features/`, and changes `src/app.js`
    When a tool runs `specgate agent ask "…" --json`, then `specgate agent ask "…" --mode code --json`
    Then the first plan's `files` are `spec.md` and the feature file, and `status` has `edit_refused` for `src/app.js`; the second is refused with `agent_mode_unknown` and the agent did not run
