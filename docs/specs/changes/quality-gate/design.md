# Design: quality-gate

ADR-0040 decides the mechanism; this file records how it is built and, per
stack and per tool, what each preset runs. Tool flags marked **(verify)** were
written from memory and must be checked against the tool's current release
before the preset ships (REQ-230 runs every preset against a fixture, which is
where a wrong flag is caught).

## 1. Configuration

`harness.config.yaml`:

```yaml
# basic | strict | custom. basic and strict expand to the checks of the stack
# detected; custom uses only the list below. The list may also extend a level.
quality: strict

# Thresholds Specgate applies itself (REQ-223, REQ-224).
diff_coverage: 80        # % of the changed executable lines a test runs
mutation_score: 70       # % of the mutants on changed lines a test kills

checks:
  - name: spotbugs
    run: "./mvnw -B -q compile spotbugs:check -Dspotbugs.sarifOutput=true"
    when: attempt          # attempt | end | ci
    gate: true             # false: reported, never fails
    sarif: target/spotbugsSarif.json
    timeout: 600           # seconds
  - name: sonar
    run: "./mvnw -B verify sonar:sonar -Dsonar.qualitygate.wait=true"
    when: ci
    env: [SONAR_TOKEN, SONAR_HOST_URL]   # read from the environment only
```

Placeholders substituted in `run`, as `test_cmd` already does for `{req}`:

| Placeholder         | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `{req}`             | the requirement under test, `REQ-007`                                 |
| `{base}`            | the commit the requirement's branch started from                      |
| `{changed_files}`   | files the change touched, space-separated, repository-relative        |
| `{changed_classes}` | Java: fully qualified classes of the changed `src/main/java` files, comma-separated (PIT's `targetClasses`) |
| `{changed_src}`     | TypeScript: changed files under the source roots, comma-separated (Stryker's `--mutate`) |
| `{report_dir}`      | `.specgate/quality/<req>/`, created, git-ignored                      |

Validation (REQ-218): unknown keys refused with the known list, as the config
reader already does; `when` and `gate` checked; a `sarif`/report path must be
relative; `env` names only (a value is refused, naming the risk).

## 1b. Where a tool runs: installed, or in a container (REQ-232)

The scanners (Semgrep, gitleaks, osv-scanner, OWASP Dependency-Check, Snyk,
the SonarQube scanner) are separate programs a developer rarely has
installed. Each preset names an official image, so a machine with Docker and
none of them runs every check the same way CI does.

```yaml
checks:
  - name: semgrep
    run: "semgrep scan --config p/java --sarif --output {report_dir}/semgrep.sarif"
    image: "semgrep/semgrep@sha256:<digest>"   # pinned by digest in the preset
    runner: auto        # auto | local | docker
    network: true       # false: --network none, for scanners that need nothing
```

- `runner: auto` (the default): the command's program on `PATH` runs it
  locally; otherwise, when `docker` answers, the image runs it; otherwise the
  check is reported as unavailable, naming both ways to get it (install the
  tool, or start Docker). `local` and `docker` force one way.
- The container: `docker run --rm -v <worktree>:/src -w /src` — the harness
  mounts the requirement's worktree, not the main checkout; on Linux and
  macOS `--user <uid>:<gid>`, so reports are not owned by root; Windows paths
  converted for Docker Desktop; `{report_dir}` lives under the mount.
- Tokens: `env:` names are forwarded as `-e NAME`, the value taken from the
  host's environment by Docker, never written on the command line Specgate
  prints or logs.
- Caches: a named volume per tool where the tool has a database
  (`specgate-dependency-check-data` for the NVD cache,
  `specgate-semgrep-cache`), so the second run is fast.
- Image pulls: not counted against the check's `timeout`; `specgate quality
  doctor` lists each check as local, docker or unavailable, and `--pull`
  fetches the images ahead of a run (CI warms them once).
- Images by digest, refreshed with the presets in a release; a person may
  override `image:` (a mirror for an air-gapped network, as for packs).

What stays in the project's build, never in a container: JaCoCo, PIT,
SpotBugs, PMD, Checkstyle, Error Prone and ArchUnit run through the Maven or
Gradle wrapper (they are plugins of the build, and a container would need the
whole JDK and dependency cache); the same for Vitest/Jest coverage, Stryker,
ESLint, tsc and dependency-cruiser through the project's `node_modules`. A
machine without a JDK can still set `runner: docker` with an image such as
`maven:3.9-eclipse-temurin-21` and the `~/.m2` cache mounted — an option, not
the default.

Official images the presets name (digest pinned at implementation time,
**(verify)** each): `semgrep/semgrep`, `ghcr.io/gitleaks/gitleaks`,
`ghcr.io/google/osv-scanner`, `owasp/dependency-check`, `snyk/snyk:maven-3-jdk-21`
and `snyk/snyk:node`, `sonarsource/sonar-scanner-cli`; Aikido's, if it
publishes one.

## 2. Where checks run

| Command / moment                 | `attempt` | `end` | `ci` |
| -------------------------------- | :-------: | :---: | :--: |
| harness, inside each attempt     |    yes    |       |      |
| harness, before merging a branch |           |  yes  |      |
| harness `--chain`, after the last|           |  yes  |      |
| `specgate check`                 |    yes    |  yes  |      |
| `specgate check --ci`            |    yes    |  yes  | yes  |
| `specgate done REQ-x`            |    yes    |  yes  |      |

Order inside a stage: the list's order; cheap first is the convention the
presets follow. A failing `gate: true` check stops the stage; an advisory one
is recorded and the stage goes on.

Feedback to the agent (REQ-220): the next attempt's prompt gets a section per
failed check — its name, exit code, and at most 20 new findings as
`path:line [rule] message`, then "and N more in <report>". For diff coverage,
the uncovered changed lines; for mutation, the surviving mutants as
`path:line mutator — description`. Same budget rules as a failing test's
output today.

## 3. Baseline and SARIF (REQ-222, REQ-231)

- Reader: SARIF 2.1.0, `runs[].results[]` with `ruleId`, `level`, first
  physical location, `partialFingerprints` when present.
- Fingerprint: the tool's `partialFingerprints` if given; otherwise
  `ruleId + path + sha1(normalised text of the flagged line ± 1 line)`, so a
  finding that only moved keeps its identity.
- `.specgate/quality-baseline.json`: per check, the fingerprints accepted.
  `specgate quality baseline` writes it from a full run; `--accept <check>`
  adds the current findings of one check; a finding fixed drops out on the
  next `baseline`. Committed; `check` warns when it is older than the build
  file it was taken with.
- New findings only: a result whose fingerprint is not in the baseline. On a
  harness branch, additionally limited to `{changed_files}` unless the check
  says `scope: all`.
- `arch_cmd` gets the same treatment when it writes SARIF (ArchUnit does not;
  its `FreezingArchRule` is the Java-side baseline and the preset uses it).

## 4. Measures Specgate computes

### Diff coverage (REQ-223)

- Changed lines: `git diff --unified=0 {base}...HEAD` on source files, added
  or modified lines only.
- Coverage readers, all zero-dependency XML/text parsing:
  - JaCoCo XML: `<sourcefile name>` under `<package name>` → path;
    `<line nr mi ci>` → executable when `mi+ci>0`, covered when `ci>0`.
  - LCOV: `SF:`, `DA:<line>,<hits>`.
  - Cobertura: `<class filename>` and `<line number hits>`.
- Result: covered changed executable lines / changed executable lines; the
  uncovered ones listed. No executable changed line: not applicable, passes.
- Report paths by preset: Maven `target/site/jacoco/jacoco.xml`; Gradle
  `build/reports/jacoco/test/jacocoTestReport.xml`; Vitest/Jest/c8
  `coverage/lcov.info`.

### Mutation score (REQ-224)

- PIT `mutations.xml`: `<mutation detected status>` with `<sourceFile>`,
  `<mutatedClass>`, `<lineNumber>`, `<mutator>`, `<description>`. Killed =
  `KILLED` or `TIMED_OUT`; `NO_COVERAGE` and `SURVIVED` count against.
- StrykerJS `mutation.json` (mutation-testing-elements schema): `files[path]
  .mutants[]` with `status` and `location.start.line`. Killed = `Killed`,
  `Timeout`; `Survived` and `NoCoverage` against; `Ignored`,
  `CompileError`, `RuntimeError` excluded.
- Score over the mutants on changed lines only. Survivors listed for the
  agent.

## 5. Levels

| Check                                  | basic           | strict              |
| -------------------------------------- | --------------- | ------------------- |
| Compile + types (Error Prone / `tsc`)  | attempt         | attempt             |
| Lint, no new findings                  | attempt         | attempt             |
| Secrets (gitleaks)                     | attempt         | attempt             |
| Diff coverage                          | attempt, 70 %   | attempt, 85 %       |
| Dependencies (osv-scanner)             | end             | attempt             |
| Static analysis (SpotBugs+FindSecBugs / ESLint security) | end | attempt      |
| Complexity and duplication (PMD+CPD / ESLint+jscpd) | —  | attempt             |
| Architecture (ArchUnit / dependency-cruiser) | if present | attempt          |
| SAST (Semgrep)                         | —               | end                 |
| Mutation on the diff (PIT / Stryker)   | —               | end, 70 %           |
| Flaky: new tests run 3×                | —               | end                 |
| Review agent against the spec          | —               | end, advisory       |
| Platform (Sonar / Snyk / Aikido)       | ci, if token    | ci, if token        |

## 6. Java presets (Maven first, Gradle second)

The preset only runs a plugin the build declares; otherwise it writes the
check commented with the plugin block to add. forja's generated `pom.xml`
should declare them (follow-up in forja, F4 below).

| Purpose | Maven (`./mvnw -B …`) | Gradle (`./gradlew …`) | Report |
| --- | --- | --- | --- |
| Coverage | `jacoco:prepare-agent test jacoco:report` | `test jacocoTestReport` (xml.required = true) | JaCoCo XML |
| Mutation | `org.pitest:pitest-maven:mutationCoverage -DtargetClasses={changed_classes} -DoutputFormats=XML -DtimestampedReports=false` + `pitest-junit5-plugin` | `pitest` (plugin `info.solidsoft.pitest`, `targetClasses` from a property) | `target/pit-reports/mutations.xml` |
| Bugs + security bugs | `spotbugs:check -Dspotbugs.sarifOutput=true` with FindSecBugs plugin **(verify)** | `spotbugsMain` with `reports.sarif.required` **(verify)** | SARIF |
| Style, complexity | `pmd:check -Dformat=sarif` **(verify)**; rules CyclomaticComplexity, CognitiveComplexity, NcssCount, GodClass | `pmdMain` | SARIF / exit code |
| Duplication | `pmd:cpd-check` | `cpdCheck` (plugin) | exit code |
| Conventions | `checkstyle:check` (SARIF output **(verify)**) | `checkstyleMain` (`reports.sarif.required` **(verify)**) | SARIF |
| Compiler checks | Error Prone as `maven-compiler-plugin` annotation processor | `net.ltgt.errorprone` plugin | exit code |
| Architecture | `test -Dtest=ArchitectureTest` with `FreezingArchRule` | `test --tests '*ArchitectureTest'` | exit code |
| Dependencies | `osv-scanner scan source -r . --format sarif` (reads pom.xml / gradle lockfiles); or `org.owasp:dependency-check-maven:check -Dformat=SARIF -DfailBuildOnCVSS=7` (needs `NVD_API_KEY`, slow first run → `end`) | same / `dependencyCheckAnalyze` | SARIF |
| SAST | `semgrep scan --config p/java --sarif --output {report_dir}/semgrep.sarif` (offline: a local rules folder) | same | SARIF |
| Secrets | `gitleaks git --log-opts "{base}..HEAD" --report-format sarif --report-path {report_dir}/gitleaks.sarif` **(verify subcommand per version)** | same | SARIF |
| Flaky | `test -Dtest={changed_tests} -Dsurefire.rerunFailingTestsCount=0`, run 3× by Specgate | same, `--rerun-tasks` | exit code |
| API contract | `oasdiff breaking {base_openapi} target/openapi.json --fail-on ERR` (springdoc writes the spec) **(verify)** | same | exit code |
| Property tests | jqwik (a library, not a check: the drafting guide suggests it for rules with numbers) | | |
| SonarQube | `verify sonar:sonar -Dsonar.qualitygate.wait=true`, `SONAR_TOKEN`, `SONAR_HOST_URL` | `sonar` (plugin `org.sonarqube`) | exit code |
| Snyk | `snyk test --all-projects --severity-threshold=high --sarif-file-output={report_dir}/snyk.sarif` and `snyk code test --sarif-file-output=…`, `SNYK_TOKEN` | same | SARIF |
| Aikido | CI scan through Aikido's CI client / local scanner, `AIKIDO_CLIENT_API_KEY` **(verify the CLI, its flags and output before writing the preset)** | same | to confirm |

## 7. Node.js / React presets

| Purpose | Command (npm; pnpm/yarn equivalents by lockfile) | Report |
| --- | --- | --- |
| Types | `npx tsc --noEmit` (strict in tsconfig) | exit code |
| Lint, complexity | `npx eslint . -f @microsoft/eslint-formatter-sarif -o {report_dir}/eslint.sarif`; rules `complexity`, `max-lines-per-function`, `max-depth`, `sonarjs/cognitive-complexity` | SARIF |
| Coverage | Vitest `--coverage --coverage.reporter=lcov`; Jest `--coverage --coverageReporters=lcov` | `coverage/lcov.info` |
| Mutation | `npx stryker run --incremental --mutate {changed_src} --reporters json` (`@stryker-mutator/vitest-runner` or jest-runner) | `reports/mutation/mutation.json` |
| Duplication | `npx jscpd --min-tokens 70 --reporters json {changed_src}` **(verify SARIF reporter)** | JSON / exit code |
| Architecture | `npx depcruise src --output-type err` with known-violations baseline (`--ignore-known`) | exit code |
| Dependencies | `npm audit --audit-level=high` / `osv-scanner scan source -r .` | exit code / SARIF |
| SAST | `semgrep scan --config p/typescript --config p/react --sarif` | SARIF |
| Secrets | gitleaks as above | SARIF |
| Accessibility | `@axe-core/playwright` inside the e2e tests of screen scenarios (a library; a non-functional requirement names it) | test result |
| Performance budgets | `npx lhci autorun` with `budgets.json` (a non-functional requirement with a number) | exit code |
| API contract | oasdiff, when the project publishes OpenAPI | exit code |
| Property tests | fast-check (library) | |
| SonarQube | `npx @sonar/scan -Dsonar.qualitygate.wait=true` **(verify package name)** | exit code |
| Snyk | `snyk test` / `snyk code test` as above | SARIF |
| Aikido | as above **(verify)** | to confirm |

## 8. Code layout

| File | Role |
| --- | --- |
| `packages/core/src/domain/QualityChecks.ts` | the `checks:` model, levels, validation, placeholder expansion (pure) |
| `packages/core/src/domain/Sarif.ts` | SARIF reading, fingerprints, baseline diff (pure) |
| `packages/core/src/domain/DiffCoverage.ts` | diff hunks + JaCoCo/LCOV/Cobertura → diff coverage (pure) |
| `packages/core/src/domain/MutationScore.ts` | PIT XML / Stryker JSON → score on changed lines (pure) |
| `packages/core/src/infrastructure/QualityBaselineFile.ts` | `.specgate/quality-baseline.json` read/write |
| `scripts/lib/quality-run.ts` | runs a stage: env check, timeout, report collection, outcome |
| `scripts/cli/commands/quality/QualityCommand.ts` | `quality list | init [--level] | baseline [--accept <check>] | run [--stage]` |
| `templates/quality/{maven,gradle,node}.yaml` | the presets per level, as data |
| `CheckCommand`, `DoneCommand`, `RunCommand` | call the stages (§2) |
| `harness/prompt.ts` | the feedback section (§2) |
| `live-model.ts`, `live-page.ts`, `studio-route.ts`, `studio-app-page.ts` | results shown (REQ-229) |
| `e2e/fixtures/quality-{maven,gradle,node}/` | the fixture projects REQ-230 runs presets against |

Run record (`.harness/runs/*.json`), per requirement:

```json
"checks": [
  { "name": "diff-coverage", "stage": "attempt", "ok": true, "ms": 820, "value": 91.7 },
  { "name": "pit", "stage": "end", "ok": false, "ms": 48210, "value": 62.5, "new": 3 },
  { "name": "spotbugs", "stage": "attempt", "ok": true, "ms": 15400, "new": 0, "baselined": 12 }
]
```

## 9. Follow-ups outside this repository

- **F4 (forja):** the generated Java project declares JaCoCo, PIT with the
  JUnit 5 plugin, SpotBugs with FindSecBugs, PMD, Checkstyle and Error Prone,
  and its `harness.config.yaml` says `quality: strict`; the generated
  TypeScript project declares Vitest coverage, Stryker, ESLint with SARIF and
  dependency-cruiser.
- **fuhrerschein-app:** adopt `quality: basic` first, take the baseline, move
  to `strict` once the baseline is small.

## 10. Risks

- Slow `end` stage on big Java builds (PIT): scoped to `{changed_classes}`
  and PIT's history file; the chain runs it once.
- A tool's SARIF without stable fingerprints makes moved findings look new:
  the line-text hash mitigates it; a check can opt out with `baseline: exit`.
- Platform quotas (Snyk, Aikido free plans): platform presets are `ci` only.
- The agent "fixing" a finding by suppressing it (`@SuppressWarnings`,
  `// eslint-disable`, `@SuppressFBWarnings`): a new suppression in the diff
  is itself a finding of the gate unless the line carries a reason.
