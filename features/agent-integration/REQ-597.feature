Feature: Codex gets specgate's steps

  @REQ-597 @SCN-597a
  Scenario: The steps in Codex
    Given a project set up for Codex
    When the person runs `specgate agents init --tool codex`
    Then `.agents/skills/` holds specgate-draft, specgate-apply and specgate-check, each with its SKILL.md
