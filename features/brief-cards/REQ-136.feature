Feature: The brief is checked before any agent runs

  @REQ-136 @SCN-136a
  Scenario: A brief with an empty module
    Given a Lingo brief whose courses section holds only the comment "<!-- rules go here -->"
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 1, names `B2_empty_module` for courses with its fix, and `git status` shows no change

  @REQ-136 @SCN-136b
  Scenario: Drafting over an error
    Given the same brief
    When the developer runs `specgate propose --from-brief courses`
    Then it exits 1 with `brief_not_ready`, and `docs/specs/changes/draft-courses` does not exist

  @REQ-136 @SCN-136c
  Scenario: Warnings only
    Given a Lingo brief whose only finding is a rule saying "The list of courses loads fast"
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 0, shows `B5_vague` and `B6_unmeasured` for courses, and says "Ready to draft"
