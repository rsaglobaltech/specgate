Feature: The draft skill sends the agent to a guide that exists

  @REQ-797 @SCN-797a
  Scenario: The step names the command
    Given the `draft` step as `specgate agents init` writes it
    When an agent reads it
    Then it names `specgate propose --from-brief --guide setup` and `--guide cards`, and neither `docs/specs/BRIEF-SETUP.md` nor `docs/specs/BRIEF-CARDS.md`

  @REQ-797 @SCN-797b
  Scenario: The overview names the cards guide
    Given `docs/brief.md` with a complete front matter listing `courses` and `lessons`, and no `## Module:` section
    When `specgate propose --from-brief` runs
    Then its output names `specgate propose --from-brief --guide cards`
