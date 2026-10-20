Feature: A monorepo's stack is read from its apps

  @REQ-153 @SCN-153a
  Scenario: A Spring API and a Next.js web app
    Given a project whose root `package.json` declares workspaces, with `apps/api/pom.xml` using Spring Boot and Testcontainers, and `apps/web/package.json` using `next` and TypeScript
    When the developer runs `specgate adopt --no-capabilities`
    Then the `AGENTS.md` stack line names "Spring Boot" with "(apps/api)" and "next" with "(apps/web)", and its testing names JUnit 5 and Testcontainers
