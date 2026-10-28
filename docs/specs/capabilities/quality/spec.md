# Quality

## Requirements

### Requirement: REQ-218 — The quality checks are read, validated and listed

The system SHALL read `quality`, `diff_coverage`, `mutation_score` and `checks:` from harness.config.yaml — each check a name, a command, the stage it runs in (attempt, end or ci), whether it gates, how it runs (docker, local or auto) with its image, its environment variable names, named volumes, timeout, SARIF path and report — refusing a check it cannot run safely and naming why, and SHALL list them with `specgate quality list`, saying for each how it runs on this machine or why it cannot.

#### Scenario: SCN-218a — A valid list of checks

- GIVEN harness.config.yaml with `quality: strict` and two checks, spotbugs at attempt and pit at end
- WHEN `specgate quality list --json` runs
- THEN both are listed with their stage and whether they gate, and the thresholds are the strict level's, 85 and 70

#### Scenario: SCN-218b — A secret written into the file is refused

- GIVEN a check whose `env` says `SONAR_TOKEN=abc`
- WHEN the configuration is read
- THEN it is refused saying env lists names only, and nothing runs

#### Scenario: SCN-218c — A host folder mounted into a container is refused

- GIVEN a check whose `volumes` lists `/home/me:/data`
- WHEN the configuration is read
- THEN it is refused saying a volume is name:/path, never a host folder

<!-- specgate:trace actor=Developer feature=features/quality/REQ-218.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-219 — The checks run in the gate by stage

The system SHALL run, in `specgate check` after the tests, the checks of the attempt and end stages in the file's order, and with `--ci` those of the ci stage too, each with the files changed since the base filled into its command; a gating check that fails SHALL fail the gate with its name and its last output; an advisory one SHALL be reported and never fail it; a check that cannot run on this machine SHALL be reported and skipped, except under `--ci`, where it fails the gate; and `specgate quality run [--stage]` SHALL run a stage on its own.

#### Scenario: SCN-219a — A failing gating check fails the gate

- GIVEN a passing specification and a local check `lint` at attempt that exits 1
- WHEN `specgate check` runs
- THEN it fails naming lint, after the specification passed

#### Scenario: SCN-219b — An advisory check never fails it

- GIVEN the same check with `gate: false`
- WHEN `specgate check` runs
- THEN the gate passes and the check's outcome is reported as failed

#### Scenario: SCN-219c — The ci stage runs only with --ci

- GIVEN a check at the ci stage
- WHEN `specgate check` runs, then `specgate check --ci`
- THEN the first does not run it and the second does

<!-- specgate:trace actor=Developer feature=features/quality/REQ-219.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-232 — A check runs in its container

The system SHALL run a check with `runner: docker` in its image, the project mounted at /src as the working directory, the person's user on Linux and macOS, the network off when the check says so, its environment variables forwarded by name only, and its named volumes mounted; SHALL pull a missing image before the check's time starts; SHALL stop the container when the check's time runs out; and `specgate quality doctor [--pull]` SHALL say whether Docker answers and fetch the images ahead of a run.

#### Scenario: SCN-232a — The container's command line

- GIVEN a check with image `semgrep/semgrep`, `network: false`, env SONAR_TOKEN and a volume `specgate-cache:/cache`
- WHEN its docker command is built for /work/app
- THEN it mounts /work/app at /src, works in /src, has `--network none`, `-e SONAR_TOKEN` without a value, `-v specgate-cache:/cache`, and runs the command through sh in the image

#### Scenario: SCN-232b — A check really runs in Docker

- GIVEN Docker answers and a check running `test -f /src/marker.txt` in `alpine`
- WHEN the check runs in a project holding marker.txt
- THEN it passes, and it fails in a project without it

<!-- specgate:trace actor=Developer feature=features/quality/REQ-232.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-222 — Only the findings a change adds fail the gate

The system SHALL read the SARIF a check writes and judge the check by its findings rather than its exit code: a finding whose fingerprint — the tool's own, or the rule, the file and the text of the flagged line with its neighbours — is in `.specgate/quality-baseline.json` is existing debt and does not fail it, and with `scope: diff` only findings in files the change touched count; `specgate quality baseline [--accept <check>]` SHALL record the current findings of every check that writes SARIF, or of one; and the gate's failure SHALL name each new finding as `path:line [rule] message`.

#### Scenario: SCN-222a — Debt in the baseline passes, a new finding fails

- GIVEN a check whose SARIF reports one finding in src/a.js, and a baseline taken with it
- WHEN a second finding appears in src/a.js and the check runs
- THEN it fails naming only the new one, as `src/a.js:<line> [rule] message`, and says one is in the baseline

#### Scenario: SCN-222b — Moved code is not new code

- GIVEN the baselined finding's line moved two lines down, its text unchanged
- WHEN the check runs
- THEN it passes

<!-- specgate:trace actor=Developer feature=features/quality/REQ-222.feature kind=functional status=Implemented test=tests/unit/quality-baseline.test.ts -->

### Requirement: REQ-223 — The tests run the lines a change touched

The system SHALL, for a check whose `report` is a JaCoCo XML, LCOV or Cobertura file, measure the share of the executable lines changed since the base — committed or not, an untracked file counting whole — that a test ran, fail the check below `diff_coverage` (the level's when not set), name each uncovered changed line as `path:line`, pass a change with no executable changed line, and fail a check whose report is missing.

#### Scenario: SCN-223a — Below the threshold, the uncovered lines are named

- GIVEN `diff_coverage: 80`, a change that adds five executable lines to src/a.js, and an LCOV report where a test ran three of them
- WHEN the check runs
- THEN it fails with 60%, naming the two lines no test ran

#### Scenario: SCN-223b — JaCoCo's package paths match the repository's

- GIVEN a change to src/main/java/com/shop/Order.java and a JaCoCo report of com/shop/Order.java where every changed line ran
- WHEN the check runs
- THEN it passes with 100%

<!-- specgate:trace actor=Developer feature=features/quality/REQ-223.feature kind=functional status=Implemented test=tests/unit/quality-measures.test.ts -->

### Requirement: REQ-224 — The tests kill the mutants on the lines a change touched

The system SHALL, for a check whose `report` is PIT `mutations.xml` or StrykerJS `mutation.json`, compute the mutation score over the mutants on lines changed since the base — killed and timed out counting as killed; no coverage and survived against; ignored, non-viable and errors left out — fail the check below `mutation_score` (the level's when not set), and name each surviving mutant as `path:line mutator`.

#### Scenario: SCN-224a — A survivor on a changed line fails it

- GIVEN `mutation_score: 70`, a change to Order.java lines 10 and 11, and a PIT report with a killed mutant on line 10, a surviving one on line 11 and a surviving one on unchanged line 30
- WHEN the check runs
- THEN it fails with 50%, naming the survivor on line 11 and not the one on line 30

#### Scenario: SCN-224b — Stryker's statuses

- GIVEN a Stryker report on the changed lines with Killed, Timeout, Survived and Ignored mutants
- WHEN the score is computed
- THEN it is 2 of 3, the ignored one left out

<!-- specgate:trace actor=Developer feature=features/quality/REQ-224.feature kind=functional status=Implemented test=tests/unit/quality-measures.test.ts -->

### Requirement: REQ-225 — The checks of a level, for the project's stack

The system SHALL, with `specgate quality init [--level basic|strict] [--force]`, write into harness.config.yaml the checks of the level for each stack the build files give away — Maven (pom.xml), Gradle (build.gradle) and Node (package.json, with npm, pnpm or yarn by its lockfile) — every one running in Docker with a pinned image and tools that need no account, the Java image chosen by the JDK the build declares; SHALL write commented, with what to add, a check whose tool the build lacks (PIT without pitest-maven, Vitest coverage without its provider, Stryker without its package); SHALL keep every other line of the file; and SHALL refuse to replace existing checks without `--force`.

#### Scenario: SCN-225a — Strict for a Maven project

- GIVEN a pom.xml declaring Java 17 and no pitest-maven
- WHEN `specgate quality init --level strict` runs
- THEN the file lists secrets, dependencies, coverage, spotbugs, pmd and semgrep in Docker, the Maven ones in `maven:3.9-eclipse-temurin-17`, and mutation commented with pitest-maven named

#### Scenario: SCN-225b — A Node project with pnpm and Vitest

- GIVEN a package.json with typescript, eslint, vitest and @vitest/coverage-v8, and a pnpm-lock.yaml
- WHEN `specgate quality init` runs
- THEN types, lint and coverage run in `node:22` after a pnpm install, coverage reads lcov, and dependencies scans pnpm-lock.yaml

#### Scenario: SCN-225c — The rest of the file is kept, the checks are not replaced unasked

- GIVEN harness.config.yaml with test_cmd and existing checks
- WHEN `specgate quality init` runs, then with `--force`
- THEN the first is refused and changes nothing; the second keeps test_cmd and replaces the checks

<!-- specgate:trace actor=Developer feature=features/quality/REQ-225.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->

### Requirement: REQ-230 — The presets run for real

The system SHALL keep a fixture project per stack — Maven, Gradle and Node — whose preset runs in Docker in the test suite, skipped and said so where Docker does not answer: the Maven one at strict, proving that the coverage, SpotBugs, PMD, Semgrep and PIT checks run, that the baseline holds back the existing findings, and that a change with a new finding, an untested line and surviving mutants fails exactly those checks; the Gradle and Node ones at basic, proving that their coverage measures the lines a change adds and names those no test runs.

#### Scenario: SCN-230a — A Maven change judged by the strict preset in Docker

- GIVEN the fixture with a baseline taken, and a change adding Discount.java with a String compared with ==, a branch no test runs, and one test
- WHEN `specgate quality run` runs
- THEN spotbugs fails on Discount.java:5 only, coverage fails naming the untested lines, mutation fails naming survivors on Discount.java, and pmd and semgrep pass

#### Scenario: SCN-230b — A Gradle change judged by the basic preset in Docker

- GIVEN the Gradle fixture, with JaCoCo applied and dependency locking on, and a change adding Discount.java without a test
- WHEN the attempt checks run
- THEN commits and secrets pass and coverage fails at 0%, naming only lines of Discount.java

#### Scenario: SCN-230c — A Node change judged by the basic preset in Docker

- GIVEN the Node fixture with TypeScript, Vitest and its coverage provider, and a change adding src/discount.ts without a test
- WHEN the attempt checks run
- THEN types pass and coverage fails, naming lines of src/discount.ts

<!-- specgate:trace actor=Developer feature=features/quality/REQ-230.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->

### Requirement: REQ-234 — Commit messages follow Conventional Commits 1.0.0

The system SHALL provide a built-in check, `run: builtin:commits`, that parses each commit since the base — merge commits left out, and `fixup!`/`squash!` ones except in CI — against Conventional Commits 1.0.0: a type from feat, fix, build, chore, ci, docs, perf, refactor, revert, style and test plus those `commit_types:` adds, an optional non-empty scope, an optional `!`, a colon, a space and a description, a blank line before any body, and `BREAKING CHANGE` in capitals; a failure SHALL name each commit by its short hash and subject with the rule it breaks; `quality init` SHALL write the check for every stack; every commit message Specgate itself writes SHALL follow the format; and the harness prompt SHALL ask the agent for it, with the requirement as scope.

#### Scenario: SCN-234a — A message without a type fails the check, named

- GIVEN a branch with the commits "feat(REQ-007): book a slot" and "Update stuff" since main
- WHEN the commits check runs
- THEN it fails naming the second by its hash and subject, saying it has no type

#### Scenario: SCN-234b — The grammar's rules

- GIVEN the messages "feat: x", "fix(api)!: y", "feat:no space", "feature: z", "feat(): w", a body without a blank line, and "breaking change: v" as a footer
- WHEN each is parsed
- THEN the first two pass, the second as breaking, and each of the others fails with its rule

#### Scenario: SCN-234c — Specgate's own commits conform

- GIVEN the messages the harness, the ticket opening, the studio and a contribution write
- WHEN each is parsed
- THEN none breaks a rule, the harness's naming the requirement as its scope

<!-- specgate:trace actor=Developer feature=features/quality/REQ-234.feature kind=functional status=Implemented test=tests/unit/quality-commits.test.ts -->

### Requirement: REQ-220 — The checks run in every harness attempt

The system SHALL, in the harness gate of each attempt and after the tests pass, run the attempt checks in the attempt's worktree with the requirement and the files it changed filled in; a gating check that fails SHALL fail the attempt at `quality check: <name>`, and its output — the new findings, the uncovered lines or the surviving mutants — SHALL reach the agent's next attempt with a hint that says to fix, not silence; a check that cannot run SHALL be reported and skipped; and the adversary's re-run and the gate after a merge SHALL not repeat the checks.

#### Scenario: SCN-220a — A failing check fails the attempt

- GIVEN a check `marker` that fails until src/ok.ts exists, and an agent that does not write it
- WHEN the harness runs one attempt
- THEN the requirement fails at `quality check: marker`

#### Scenario: SCN-220b — The agent reads the check's output and fixes it

- GIVEN the same check, and an agent that writes src/ok.ts once its prompt carries the check's output
- WHEN the harness runs two attempts
- THEN the second passes

<!-- specgate:trace actor=Developer feature=features/quality/REQ-220.feature kind=functional status=Implemented test=tests/unit/quality-harness.test.ts -->

### Requirement: REQ-221 — The end checks run once the attempt checks pass

The system SHALL run the end checks in the same gate after every attempt check has passed — so once for the attempt that is merged, not for those the cheaper checks already refused — their failure going back to the agent like an attempt check's.

#### Scenario: SCN-221a — End after attempt

- GIVEN an attempt check `marker` and an end check `final`
- WHEN an attempt passes
- THEN `marker` ran before `final`, and both passed

<!-- specgate:trace actor=Developer feature=features/quality/REQ-221.feature kind=functional status=Implemented test=tests/unit/quality-harness.test.ts -->

### Requirement: REQ-228 — The run record keeps each check's outcome

The system SHALL keep, in the run record of a requirement that passes, each quality check of its passing attempt — name, stage, whether it gates, runner, time, verdict, new and baselined findings, and the coverage or mutation measure with its threshold — without the check's output.

#### Scenario: SCN-228a — The record of a passing requirement

- GIVEN a requirement that passes with the checks `marker` and `final`
- WHEN its run record is read
- THEN its result lists both, in order, with their stage and verdict, and no output

<!-- specgate:trace actor=Developer feature=features/quality/REQ-228.feature kind=functional status=Implemented test=tests/unit/quality-harness.test.ts -->

### Requirement: REQ-229 — The quality is shown where the work is followed

The system SHALL summarise, from the run records, the quality checks of each requirement's latest passing result — its diff coverage and mutation score, the checks that ran or were skipped — and show it in `harness report` (a section and its JSON), in the studio's report (a card with the means, and each delivered requirement's figures, also in the downloadable page) and in the studio's project page (the checks configured, how each runs on this machine, whether Docker answers, and a button to turn on the basic or strict level); SHALL name each check's measure or new findings in the gate step `/live` shows; and the studio's new-project step SHALL ask for a quality level — basic by default, strict or none — and write its checks.

#### Scenario: SCN-229a — The harness report sums the quality up

- GIVEN run records where REQ-002 passed with diff coverage 90% and mutation 80%, and REQ-003 with 70% and 60%
- WHEN `specgate harness report --json` runs
- THEN its quality says 2 measured, coverage 80, mutation 70, and each check with how often it ran

#### Scenario: SCN-229b — The studio's report shows each requirement's figures

- GIVEN the same records and both requirements Implemented
- WHEN the studio's report is read and downloaded
- THEN REQ-002 carries coverage 90 and mutation 80, the means are 80 and 70, and the page says "Quality of the code"

#### Scenario: SCN-229c — A new project with a quality level, and turning it up later

- GIVEN an empty folder and quality basic chosen in the new-project step
- WHEN the project is created, then the studio turns on strict
- THEN harness.config.yaml has `quality: basic` with the commits and secrets checks, the project page lists them, and after the switch it says strict

#### Scenario: SCN-229d — /live sees each check

- GIVEN a requirement whose gate runs the checks `marker` and `final`
- WHEN its attempt passes
- THEN its events have the gate steps `quality: marker` and `quality: final`

<!-- specgate:trace actor=Developer feature=features/quality/REQ-229.feature kind=functional status=Implemented test=tests/unit/quality-views.test.ts -->

### Requirement: REQ-226 — SonarQube Community in Docker, without an account

The system SHALL provide a built-in check, `run: builtin:sonar`, that starts SonarQube Community in a named container on a private Docker network, published on 127.0.0.1 only, when it is not running; creates an analysis token once with the server's default login and keeps it in `.specgate/sonar.local`, added to .gitignore — never changing the person's password, and taking `SONAR_TOKEN` from the environment first; analyses the project with the scanner image (Java sources, tests and classes when the project has them); and writes the open issues as SARIF with SonarQube's line hash as the fingerprint, so the baseline and the change's files judge them like any other check's. The strict preset SHALL list it commented, saying it needs about 2 GB of memory. Snyk and Aikido wait for an account.

#### Scenario: SCN-226a — SonarQube's issues as SARIF

- GIVEN two SonarQube issues, one BLOCKER on line 5 of src/main/java/com/shop/Repo.java with a line hash, one MINOR without a line
- WHEN they are written as SARIF
- THEN they are an error and a note, in the repository's paths, the first fingerprinted by its hash

#### Scenario: SCN-226b — What the scanner is told

- GIVEN a Maven project with src/main/java, src/test/java and target/classes, and a Node project with neither
- WHEN their scanner properties are built
- THEN the first names the Java sources, tests and classes, the second the whole folder without node_modules, dist, coverage or .specgate

#### Scenario: SCN-226c — A real analysis judged against the baseline

- GIVEN SPECGATE_TEST_SONAR set and Docker answering, the Maven fixture with its baseline taken by the sonar check, and a change comparing Strings with ==
- WHEN the end checks run
- THEN sonar fails on Discount.java:5 only, the fixture's own issues held back

<!-- specgate:trace actor=Developer feature=features/quality/REQ-226.feature kind=functional status=Implemented test=tests/unit/quality-sonar.test.ts -->

### Requirement: REQ-227 — A second agent reviews or attacks the change as a check

The system SHALL provide the built-in checks `builtin:review` — an agent reads the change against the requirement, its statement and scenarios, and answers `VERDICT: PASS` or `VERDICT: FAIL` with its reasons — and `builtin:adversary` — an agent writes one test that tries to break the change, and the project's tests run with it; each SHALL run the profile the check names (else the review or adversary profile, else the agent), inside the harness gate only, saying so when run elsewhere; each SHALL fail the attempt when it gates and its verdict is FAIL or its test breaks the work, and only be recorded when it does not; and neither SHALL change the implementer's work: the worktree is put back exactly as it was, files the agent added removed. The strict preset SHALL list the review, advisory.

#### Scenario: SCN-227a — A reviewer's FAIL advises, and its edits are undone

- GIVEN a review check with `gate: false` whose agent edits src/work.ts, adds a file, and answers VERDICT: FAIL
- WHEN the harness delivers a requirement whose implementer wrote src/work.ts
- THEN the requirement passes, the branch carries the implementer's src/work.ts and not the reviewer's file, and the run record keeps the review as failed and advisory

#### Scenario: SCN-227b — An adversary that breaks the tests fails the attempt

- GIVEN an adversary check with `gate: true` whose agent adds a case the tests fail on
- WHEN the harness runs the requirement
- THEN it fails at `quality check: adversary`, and the branch keeps the implementer's work without the adversary's file

#### Scenario: SCN-227c — Outside the harness, said and skipped

- GIVEN a review check
- WHEN `specgate quality run` runs
- THEN the check is skipped, saying it runs inside the harness only

<!-- specgate:trace actor=Developer feature=features/quality/REQ-227.feature kind=functional status=Implemented test=tests/unit/quality-agents.test.ts -->

### Requirement: REQ-231 — The architecture check gets the baseline too

The system SHALL, when harness.config.yaml gives `arch_sarif:` beside `arch_cmd`, judge the architecture check by the findings of that SARIF rather than by the tool's exit code — in `specgate check`, `specgate done` and the harness gate — so that a violation in the baseline does not fail it and one the change adds does, named as `path:line [rule]`; `specgate quality baseline` SHALL record its findings as the check `arch`; and outside a git repository, where what changed cannot be known, every finding not in the baseline SHALL count.

#### Scenario: SCN-231a — Debt held back, a new violation caught

- GIVEN an adopted project whose arch_cmd writes SARIF and exits 1 on lib/domain/order.js depending on infrastructure
- WHEN `specgate check` runs, then `specgate quality baseline`, then `specgate check` again, then a new lib/domain/invoice.js depends on infrastructure too
- THEN the first check fails, the baseline records one finding for arch, the second check passes, and the last fails naming lib/domain/invoice.js:1 [domain-not-to-infra]

<!-- specgate:trace actor=Developer feature=features/quality/REQ-231.feature kind=functional status=Implemented test=tests/unit/quality-arch.test.ts -->

### Requirement: REQ-235 — Quality presets for each application folder

The system SHALL, on `specgate quality init`, write the checks of a stack for each application folder that has its own build file — the root, a folder one level down, or a folder in `apps/`, `packages/` or `services/` — when the root has no build file of that stack; each such check SHALL run in its folder, with its report and SARIF paths written from the root; one Semgrep scan SHALL carry the rules of every stack found; and `{changed_classes@<folder>}` and `{changed_src@<folder>}` SHALL give only the changed files under that folder, relative to it.

#### Scenario: SCN-235a — A Spring Boot API in apps/api beside a Node root

- GIVEN a repository with `package.json` and `package-lock.json` at the root, and `apps/api/pom.xml` declaring Java 21
- WHEN `specgate quality init --level strict` runs
- THEN its checks include `coverage`, `spotbugs` and `pmd`, each running `cd apps/api && mvn` in `maven:3.9-eclipse-temurin-21`, coverage reads `apps/api/target/site/jacoco/jacoco.xml`, and one `semgrep` check carries both `p/java` and `p/typescript`

#### Scenario: SCN-235b — The changed files of one folder

- GIVEN the changed files `apps/api/src/main/java/eu/fleet/Truck.java` and `apps/web/src/map.ts`
- WHEN a check's command uses `{changed_classes@apps/api}` and `{changed_src@apps/web}`
- THEN they become `eu.fleet.Truck` and `src/map.ts`

<!-- specgate:trace actor=Developer feature=features/quality/REQ-235.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->

### Requirement: REQ-237 — Maven dependencies are scanned from the build's own bill of materials

The system SHALL, in the Maven preset, scan dependencies from a CycloneDX bill of materials that Maven writes in the project's image (`sbom`, then `dependencies` reading `target/bom.json` with osv-scanner), so the versions a parent POM or a BOM manages are the ones scanned, with Maven's own repositories and cache.

#### Scenario: SCN-237a — A Spring Boot parent manages the versions

- GIVEN a Maven project whose dependencies take their versions from `spring-boot-starter-parent`
- WHEN `specgate quality init` writes its checks
- THEN an `sbom` check runs the CycloneDX Maven plugin to `target/bom.json` before `dependencies`, which runs osv-scanner on `target/bom.json`

<!-- specgate:trace actor=Developer feature=features/quality/REQ-237.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->

### Requirement: REQ-238 — A check may reach Docker, for tests that start containers

The system SHALL accept `docker: true` on a check run in Docker, giving its container the host's Docker socket and what Testcontainers needs to reach the containers it starts; and the Maven and Gradle presets SHALL set it on the checks that run the tests when the build declares Testcontainers.

#### Scenario: SCN-238a — Spring Boot tests with Testcontainers

- GIVEN a `pom.xml` that declares `org.testcontainers`
- WHEN the coverage check's container command line is built
- THEN it mounts `/var/run/docker.sock` and sets `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`, and a check without `docker: true` mounts no socket

<!-- specgate:trace actor=Developer feature=features/quality/REQ-238.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-239 — The JSON of a quality run says why a check failed

The system SHALL include, in each outcome of `specgate quality run --json`, the last lines of what the check printed, so a failure can be read without running the tool again.

#### Scenario: SCN-239a — A check that exits 1

- GIVEN a check whose command prints "boom" and exits 1
- WHEN `specgate quality run --json` runs it
- THEN its outcome has `ok: false` and an `output` that contains "boom"

<!-- specgate:trace actor=Developer feature=features/quality/REQ-239.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-240 — The baseline runs what a check needs first

The system SHALL accept `needs: <check>` on a check, naming an earlier check whose output it reads, refusing a name that is not an earlier check; and `specgate quality baseline`, with `--accept <check>` too, SHALL run a check's needs, once each, before it; and the Maven preset's `dependencies` SHALL need `sbom`.

#### Scenario: SCN-240a — A scan of what a build step writes

- GIVEN a check `prep` that writes `built.txt`, and a check `scan` with `needs: prep` that writes SARIF from `built.txt` and writes none without it
- WHEN `specgate quality baseline --accept scan` runs on a fresh tree
- THEN `prep` runs first and `scan`'s finding is recorded in the baseline

<!-- specgate:trace actor=Developer feature=features/quality/REQ-240.feature kind=functional status=Implemented test=tests/unit/quality-baseline.test.ts -->

### Requirement: REQ-241 — A finding in a file git ignores is not the change's

The system SHALL leave out of the findings of a check judged on the change (`scope: diff`), and of its baseline, the findings in files that git ignores, since they are never part of a change; and SHALL keep them for a repository-wide check (`scope: all`), which reads generated files on purpose — a dependency scan reads the bill of materials Maven writes in `target/`.

#### Scenario: SCN-241a — A development secret in .env.local

- GIVEN `.gitignore` lists `.env.local`, a secrets scan judged on the change, and `src/config.ts` changed
- WHEN the scan reports a finding in `apps/web/.env.local` and one in `src/config.ts`
- THEN only the finding in `src/config.ts` is counted

#### Scenario: SCN-241b — Vulnerabilities in Maven's bill of materials

- GIVEN `.gitignore` lists `target/`, and a dependency scan with `scope: all` that reports a finding in `apps/api/target/bom.json`
- WHEN the check's SARIF is read
- THEN the finding is counted, and fails the check until the baseline holds it

<!-- specgate:trace actor=Developer feature=features/quality/REQ-241.feature kind=functional status=Implemented test=tests/unit/quality-baseline.test.ts -->

### Requirement: REQ-250 — Maven coverage instruments the project's own classes

The system SHALL, in the Maven preset, run the coverage check with JaCoCo's agent instrumenting only the classes of the project's group (`includes=<groupId>.*`), taken from its `pom.xml`, so libraries such as Testcontainers are not instrumented; and SHALL fall back to every class when the pom names no group.

#### Scenario: SCN-250a — A Spring Boot API whose group is eu.truckflote

- GIVEN `apps/api/pom.xml` with `<groupId>eu.truckflote</groupId>` below its Spring Boot `<parent>`
- WHEN `specgate quality init` writes the coverage check
- THEN its command loads JaCoCo's agent with `includes=eu.truckflote.*`, and its report is still `apps/api/target/site/jacoco/jacoco.xml`

<!-- specgate:trace actor=Developer feature=features/quality/REQ-250.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->

### Requirement: REQ-254 — Docker counts only when it runs Linux containers

The system SHALL treat Docker as available for the quality checks only when its server runs Linux containers, and SHALL, when it runs Windows containers, skip a Docker check saying to switch Docker Desktop to Linux containers, instead of pulling an image that has no manifest for Windows.

#### Scenario: SCN-254a — Docker Desktop on Windows containers

- GIVEN a Docker server that reports `windows` as its operating system
- WHEN a check that runs in Docker is resolved
- THEN it is skipped, saying to switch Docker Desktop to Linux containers, and no image is pulled

<!-- specgate:trace actor=Developer feature=features/quality/REQ-254.feature kind=functional status=Implemented test=tests/unit/quality-checks.test.ts -->

### Requirement: REQ-258 — The quality reports are not committed

The system SHALL, on `specgate quality init`, add `.specgate/quality/` — where each check writes its SARIF and reports — to the project's `.gitignore`, once, so a quality run leaves no untracked file behind; the baseline, `.specgate/quality-baseline.json`, stays outside it, to be committed.

#### Scenario: SCN-258a — A run after init

- GIVEN a project where `specgate quality init` ran and its result is committed
- WHEN a quality run writes `.specgate/quality/osv.sarif`
- THEN `.gitignore` lists `.specgate/quality/`, the report is not shown by `git status`, and `.specgate/quality-baseline.json` is not ignored

<!-- specgate:trace actor=Developer feature=features/quality/REQ-258.feature kind=functional status=Implemented test=tests/unit/quality-presets.test.ts -->
