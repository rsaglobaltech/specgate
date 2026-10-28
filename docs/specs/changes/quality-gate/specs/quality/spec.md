# Delta — quality

## ADDED Requirements

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-baseline.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-measures.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-measures.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-commits.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-harness.test.ts actor=Developer kind=functional -->

### Requirement: REQ-221 — The end checks run once the attempt checks pass

The system SHALL run the end checks in the same gate after every attempt check has passed — so once for the attempt that is merged, not for those the cheaper checks already refused — their failure going back to the agent like an attempt check's.

#### Scenario: SCN-221a — End after attempt

- GIVEN an attempt check `marker` and an end check `final`
- WHEN an attempt passes
- THEN `marker` ran before `final`, and both passed

<!-- specgate:trace status=Implemented test=tests/unit/quality-harness.test.ts actor=Developer kind=functional -->

### Requirement: REQ-228 — The run record keeps each check's outcome

The system SHALL keep, in the run record of a requirement that passes, each quality check of its passing attempt — name, stage, whether it gates, runner, time, verdict, new and baselined findings, and the coverage or mutation measure with its threshold — without the check's output.

#### Scenario: SCN-228a — The record of a passing requirement

- GIVEN a requirement that passes with the checks `marker` and `final`
- WHEN its run record is read
- THEN its result lists both, in order, with their stage and verdict, and no output

<!-- specgate:trace status=Implemented test=tests/unit/quality-harness.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-views.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-sonar.test.ts actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented test=tests/unit/quality-agents.test.ts actor=Developer kind=functional -->

### Requirement: REQ-231 — The architecture check gets the baseline too

The system SHALL, when harness.config.yaml gives `arch_sarif:` beside `arch_cmd`, judge the architecture check by the findings of that SARIF rather than by the tool's exit code — in `specgate check`, `specgate done` and the harness gate — so that a violation in the baseline does not fail it and one the change adds does, named as `path:line [rule]`; `specgate quality baseline` SHALL record its findings as the check `arch`; and outside a git repository, where what changed cannot be known, every finding not in the baseline SHALL count.

#### Scenario: SCN-231a — Debt held back, a new violation caught

- GIVEN an adopted project whose arch_cmd writes SARIF and exits 1 on lib/domain/order.js depending on infrastructure
- WHEN `specgate check` runs, then `specgate quality baseline`, then `specgate check` again, then a new lib/domain/invoice.js depends on infrastructure too
- THEN the first check fails, the baseline records one finding for arch, the second check passes, and the last fails naming lib/domain/invoice.js:1 [domain-not-to-infra]

<!-- specgate:trace status=Implemented test=tests/unit/quality-arch.test.ts actor=Developer kind=functional -->
