# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-255 — A command that starts with ./ runs on Windows

The system SHALL, on Windows, run a test, architecture, setup, agent or check command whose program is written `./name` as `.\name`, so cmd.exe finds it — `mvnw.cmd` beside `mvnw` — and SHALL leave the command unchanged on every other platform.

#### Scenario: SCN-255a — ./mvnw -B test

- GIVEN the test command `./mvnw -B test` and the architecture command `cd apps/api && ./mvnw -q test`
- WHEN they are run on Windows
- THEN cmd.exe runs `.\mvnw -B test` and `cd apps/api && .\mvnw -q test`, and on Linux and macOS they run as written

<!-- specgate:trace status=Implemented test=tests/unit/shell-command.test.ts actor=Developer kind=functional -->

### Requirement: REQ-256 — check leaves the working tree as it was

The system SHALL keep what `specgate check` records for the pet in the repository's git folder, so that after a check `git status` shows nothing new; outside a git repository it SHALL keep it in `.specgate/`, ignored there.

#### Scenario: SCN-256a — A check in a clean repository

- GIVEN a git repository with nothing to commit
- WHEN `specgate check` records its result for the pet
- THEN `git status --porcelain` is still empty, and the pet reads the result back

<!-- specgate:trace status=Implemented test=tests/unit/pet.test.ts actor=Developer kind=functional -->
