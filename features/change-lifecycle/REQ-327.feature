Feature: The migration starts from a commit

  @REQ-327 @SCN-327a
  Scenario: Work not committed
    Given a project with an open 0.27 change and an uncommitted edit
    When the person runs `specgate migrate 1.0`
    Then it exits 1 with `migrate_dirty_tree` and the change still has its `proposal.md`
