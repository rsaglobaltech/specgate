Feature: A ./ inside a quoted argument stays as written

  @REQ-265 @SCN-265a
  Scenario: An agent's allowance for the Maven wrapper
    Given the agent command `claude -p --allowedTools 'Bash(./mvnw:*)' "Bash(./gradlew:*)" < {prompt_file}`
    When it is run on Windows
    Then it runs as written, while `(./mvnw -q test)` still runs as `(.\mvnw -q test)`
