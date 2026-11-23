Feature: The drafting commands give Claude Code its flags in Claude's own command, not after a pipe

  @REQ-616 @SCN-616a
  Scenario: The piped agent proposes the front matter of a brief outside the project
    Given the agent `claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude` and a brief in a folder outside the project
    When the Developer runs `specgate propose --from-brief --brief <that file> --agent <that command>`
    Then the command run is `claude --add-dir "<that folder>" --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and `specgate harness events` gets no flag of Claude's

  @REQ-616 @SCN-616b
  Scenario: Edit permission for a piped agent without one
    Given the agent `claude -p < {prompt_file} | specgate harness events --from claude`
    When a drafting command runs it
    Then the command run is `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`
