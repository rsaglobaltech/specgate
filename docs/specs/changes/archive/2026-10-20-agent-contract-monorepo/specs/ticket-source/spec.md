# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-153 — A monorepo's stack is read from its apps

The system SHALL, when `specgate adopt` or `specgate init` reads the stack of a project whose root `package.json` declares workspaces, also read the build manifest (`pom.xml`, `build.gradle`, `build.gradle.kts`, `package.json`, `go.mod`, `pyproject.toml`) of each directory under `apps/`, `services/` and `backend/`, and SHALL write in `AGENTS.md` one stack per such directory that has one — naming the directory — joined with " + ", and the testing tools of each, instead of the root's Node.js alone.

#### Scenario: SCN-153a — A Spring API and a Next.js web app

- GIVEN a project whose root `package.json` declares workspaces, with `apps/api/pom.xml` using Spring Boot and Testcontainers, and `apps/web/package.json` using `next` and TypeScript
- WHEN the developer runs `specgate adopt --no-capabilities`
- THEN the `AGENTS.md` stack line names "Spring Boot" with "(apps/api)" and "next" with "(apps/web)", and its testing names JUnit 5 and Testcontainers

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-154 — The agent contract names the ticket path

The system SHALL write in every `AGENTS.md` it generates, within its length budget, a section "From a brief or a Jira ticket" saying that `specgate propose --from-ticket <KEY>` opens the ticket's change on its branch and writes `DRAFTING.md`, that `ticket.md` is never edited, and that every commit message starts with the ticket key and never uses Smart Commit commands.

#### Scenario: SCN-154a — The section is there

- GIVEN a new project
- WHEN the developer runs `specgate adopt --no-capabilities`
- THEN `AGENTS.md` has a section "From a brief or a Jira ticket" naming `specgate propose --from-ticket`, `ticket.md` and the ticket key in commit messages

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
