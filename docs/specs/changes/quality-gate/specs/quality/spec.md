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
