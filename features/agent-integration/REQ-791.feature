@change:walkthrough-fixes-3
Feature: A first pack is not rendered over a project's own specification

  @REQ-791 @SCN-791a
  Scenario: A project with its own specification
    Given a project with a capability spec holding REQ-012 and no `.specops.lock`
    When the developer runs `specgate specops add` for a pack
    Then it fails saying the project already has its own specification, and spec.md is as it was
