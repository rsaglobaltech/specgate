Feature: Mentions in the request become the agent's context

  @REQ-521 @SCN-521a
  Scenario: A requirement, a file and a mention of nothing
    Given the project of SCN-520a, where REQ-001 has a section in `spec.md` and a feature file, and `docs/notes.md` exists
    When a tool runs `specgate agent ask "cancel up to 24 h before shipping @REQ-001 @docs/notes.md @REQ-999" --json`
    Then the prompt the agent received holds REQ-001's section and names `docs/notes.md`; `plan.read` lists `spec.md`, REQ-001's feature file and `docs/notes.md`; and `status` has `mention_unresolved` for `@REQ-999`
