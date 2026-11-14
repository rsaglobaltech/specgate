Feature: The loop installs as Agent Skills

  @REQ-549 @SCN-549a
  Scenario: Skills for Cursor
    Given a specgate project
    When a tool runs `specgate agents init --format skills --tool cursor`
    Then `.agents/skills/specgate-apply/SKILL.md` and `.cursor/skills/specgate-apply/SKILL.md` exist, each with `name: specgate-apply` in its front matter
