Feature: OpenCode gets the loop's commands

  @REQ-162 @SCN-162a
  Scenario: A project that uses OpenCode
    Given a project with an `opencode.json` and no agent files
    When the developer runs `specgate agents init --tool opencode`
    Then `.opencode/commands/specgate-draft.md` exists, starts with front matter naming a description, runs `specgate propose --from-brief $ARGUMENTS`, and `AGENTS.md` exists
