# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-265 — A ./ inside a quoted argument stays as written

The system SHALL, on Windows, rewrite `./name` as `.\name` only where a command starts — at the beginning, or after `&&`, `||`, `;`, `|` or `(` — outside quotes, so an argument such as an agent's tool allowance `'Bash(./mvnw:*)'` reaches the program as written.

#### Scenario: SCN-265a — An agent's allowance for the Maven wrapper

- GIVEN the agent command `claude -p --allowedTools 'Bash(./mvnw:*)' "Bash(./gradlew:*)" < {prompt_file}`
- WHEN it is run on Windows
- THEN it runs as written, while `(./mvnw -q test)` still runs as `(.\mvnw -q test)`

<!-- specgate:trace status=Implemented test=tests/unit/shell-command.test.ts actor=Developer kind=functional -->
