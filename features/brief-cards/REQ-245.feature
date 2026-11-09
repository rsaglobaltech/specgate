Feature: The brief's shape: its size and the surfaces the project has

  @REQ-245 @SCN-245a
  Scenario: Ten modules and a driver on mobile, in a web project
    Given a front matter with ten modules and `{ name: Conductor, surfaces: [mobile] }`, in a project whose `forja.config.json` has `platforms: ["web"]`
    When the brief is checked
    Then it warns that ten modules is more than eight, and that Conductor uses mobile with no mobile app in the project
