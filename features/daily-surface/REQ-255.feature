Feature: A command that starts with ./ runs on Windows

  @REQ-255 @SCN-255a
  Scenario: ./mvnw -B test
    Given the test command `./mvnw -B test` and the architecture command `cd apps/api && ./mvnw -q test`
    When they are run on Windows
    Then cmd.exe runs `.\mvnw -B test` and `cd apps/api && .\mvnw -q test`, and on Linux and macOS they run as written
