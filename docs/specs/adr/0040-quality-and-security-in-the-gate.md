# ADR-0040 — Quality and security checks are part of the gate

## Status

Accepted — 2026-10-28 (proposed 2026-10-27). Extends ADR-0028 (architecture conformance) to every
check a team uses to judge code, and implements its pending points 3 and 4
(the baseline and SARIF) for all of them. Delivered by the change `quality-gate` (REQ-218..234).

## Context

The gate proves that a requirement has a scenario, that the scenario has real
steps, that a test names it and that the tests pass (ADR-0036), and, with
`arch_cmd`, that the code sits where the architecture says (ADR-0028). It says
nothing about whether those tests would notice a bug, whether the new code is
covered, whether it is secure, or whether it is maintainable.

Code written by an agent fails in recognisable ways that the current gate lets
through:

- **Tests that pass and prove little.** An assertion on a mock, a test that
  calls the code and checks nothing, a branch never taken. Coverage stays high
  and a mutation of the code survives.
- **New code no test runs.** The scenario's test passes; the error path the
  agent added beside it is never executed.
- **Vulnerable or leaked things.** A dependency with a known CVE added to make
  something work, an SQL string built by concatenation, a token pasted into a
  test fixture.
- **Code that grows without limit.** A 200-line method, the same block copied
  into three use cases.
- **Silent drift from the specification.** The test passes, but the code does
  more, or other, than the requirement says.

Teams already have a tool for each, per language: JaCoCo, PIT, SpotBugs, PMD,
Checkstyle, Error Prone, ArchUnit and OWASP Dependency-Check on the JVM;
Istanbul/c8, StrykerJS, ESLint, TypeScript, dependency-cruiser and jscpd for
TypeScript; Semgrep, osv-scanner and gitleaks across languages; and the
platforms SonarQube/SonarCloud, Snyk and Aikido. A rule engine of Specgate's
own would cover none of them as well, and the zero-runtime-dependency promise
rules out bundling any.

Two lessons from ADR-0028 carry over. A check that fails on an existing
codebase on day one is a wall, not a gate: only what a change *adds* may fail
it. And a check that is slow or paid for cannot run on every attempt of every
requirement.

## Decision

1. **Specgate runs the team's tools; it does not replace them.**
   `harness.config.yaml` gains `checks:`, a list of named commands beside
   `test_cmd` and `arch_cmd`. Each is any shell command, judged by its exit
   code, or by its findings when it writes SARIF.

2. **Each check says when it runs.** `attempt`: inside every harness attempt,
   its failure fed back to the agent like a failing test (cheap checks: types,
   lint, secrets, diff coverage). `end`: once, before a requirement's branch is
   merged, or at the end of a chain (mutation, SAST, a platform scan). `ci`:
   only in `specgate check --ci`. `check` and `done` run `attempt` and `end`.

3. **Only what a change adds fails it.** A check that writes SARIF has its
   findings compared with a baseline (`specgate quality baseline`), by rule,
   file and a fingerprint of the line, so moved code is not new code. A check
   that does not write SARIF is judged by its exit code, and the gate says it
   cannot be baselined. This is ADR-0028's point 3 for every check.

4. **Two measures Specgate computes itself, from standard reports.** Coverage
   of the lines a change touched, read from JaCoCo XML, LCOV or Cobertura and
   `git diff`; and the mutation score of the code a change touched, read from
   PIT's `mutations.xml` or Stryker's `mutation.json`. Parsing a report is
   within the zero-dependency promise; running the tools is the project's.

5. **Levels, so a team does not assemble twenty commands.** `quality: basic`,
   `strict` or `custom`. `harness init`, `adopt` and the studio's new-project
   step write the checks of a level for the stack they detect (Maven, Gradle,
   npm/pnpm), commented where a tool is missing from the build.

6. **Credentials never enter the repository.** A platform check (SonarQube,
   Snyk, Aikido) reads its token from the environment; `check` names the
   variable when it is unset and skips the check with a warning in `attempt`,
   fails it in `ci`. Specgate never writes a token to a file.

7. **Results are evidence of the requirement.** Each check's outcome is kept
   with the harness run and shown in the matrix, `harness report`, the live
   view and the studio's report: per requirement, diff coverage, mutation
   score and new findings.

8. **The review agent becomes a check.** The existing `review_profile` and
   `adversary_profile` can be listed in `checks:` at `end`: a second model
   compares the diff with the requirement and its scenarios, and an adversary
   writes tests that try to break it. Advisory by default, gating when the
   team says so.

9. **A scanner need not be installed.** Each preset of a standalone scanner
   (Semgrep, gitleaks, osv-scanner, OWASP Dependency-Check, Snyk, the
   SonarQube scanner) names its official image, pinned by digest. With
   `runner: auto` the installed program runs it, else Docker does, else the
   check is reported unavailable with both remedies. Tools that are plugins of
   the build (JaCoCo, PIT, SpotBugs, PMD, Checkstyle, Error Prone, ArchUnit,
   Stryker, ESLint) run through the project's own Maven, Gradle or npm.
   *First delivery:* every preset writes `runner: docker`, the build's own
   plugins included (the project's wrapper inside a Maven, Gradle or Node
   image, caches in named volumes): Docker is the only thing a machine needs.
   Only free tools are preset; SonarQube Community runs locally in Docker,
   and Snyk and Aikido wait for an account.

10. **Commit messages are checked too: Conventional Commits 1.0.0.** A
    built-in check, `commits`, parses each commit since the base with the
    spec's grammar — type, optional scope, `!`, description, body, footers,
    `BREAKING CHANGE` — natively, without a tool or a container; merge commits
    are left out. It runs in every harness attempt, so an agent's commit that
    breaks the format is refused before the merge, and in CI. The commits
    Specgate itself writes follow the format, and a test keeps them to it.

## Consequences

- `check` gets slower by the checks a team enables; the `attempt`/`end`/`ci`
  split keeps the agent's loop short and puts the expensive checks where they
  run once.
- A gate a team can trust (ADR-0036) now covers how well a requirement is
  proven, not only that it is: a requirement whose tests a mutation survives
  is not delivered at `strict`.
- The baseline is a new file to commit (`.specgate/quality-baseline.json`);
  it can only shrink without a deliberate `quality baseline --accept`.
- Specgate must keep presets current with the tools' flags; the presets are
  data (`templates/quality/`), versioned with the CLI, and every preset is run
  against a fixture project in the e2e suite.

## Alternatives considered

- **Integrate one platform (SonarQube) and let it do everything.** It covers
  much of the list, but needs a server, is slow per run, is not offline, and
  ties the gate to a vendor. It remains one check among others.
- **Rely on CI.** CI runs after the agent's work is pushed; the agent cannot
  learn from it inside its attempt, which is where the fix is cheapest.
- **A rule engine of Specgate's own.** Rejected for the reasons of ADR-0028.
