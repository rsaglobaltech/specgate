Feature: A project type for desktop apps

  @REQ-464 @SCN-464a
  Scenario: A Tauri app
    Given `specgate init` with `PROJECT_TYPE: desktop` and `STACK: Tauri 2, TypeScript`
    When the project is created
    Then its AGENTS.md says `desktop project` and its project rules name installers and auto-update
