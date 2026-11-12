# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-510 — check --affected runs the tests of what the change touches

The system SHALL, with `specgate check --affected`, compare the project with its base — `--base <ref>`, else `SPECGATE_BASE`, else origin's default branch, `main`, `master` or `develop`, the first HEAD shares history with — counting the working tree's changes and its untracked files, and SHALL take as touched each requirement whose section in a spec file has a changed line or names its id on a changed line, whose feature file changed, or whose code or test file in the matrix changed; it SHALL run the test files the matrix links to the touched requirements, every changed test file, and, in JavaScript and TypeScript, each test file whose relative imports reach a changed file; and every `check --json` answer SHALL give `selection` with its `mode` (`affected` or `full`), its `reason`, the `base`, the `changed` files, the touched `requirements`, the `tests` it selected, the `cached` ones it did not run again and the `command` it ran.

#### Scenario: SCN-510a — One requirement's code changed on a branch

- GIVEN a git project on `main` whose REQ-001 and REQ-002 each have a source file and a test file that name them, with `test_cmd` `node run-tests.js {files}`, and a branch where only REQ-001's source file changed
- WHEN a tool runs `specgate check --affected --json`
- THEN it exits 0, `selection.mode` is `affected`, `requirements` is `["REQ-001"]`, `tests` is REQ-001's test file alone, and the tests stage ran `node run-tests.js` with that one file

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-511 — A change to what every test depends on runs the whole suite

The system SHALL, when a changed file is one every test can depend on — `package.json`, a lockfile, `harness.config.yaml`, a `tsconfig` or `jsconfig` file, a build or test-runner configuration such as `pom.xml`, `build.gradle`, `pyproject.toml`, `go.mod` or `jest.config.js`, or a file matching one of the globs listed under `full_on:` in `harness.config.yaml` — run the whole suite under `check --affected`, with `selection.mode` `full` and a `reason` that names the file.

#### Scenario: SCN-511a — The lockfile changed

- GIVEN the project of SCN-510a on a branch where REQ-001's source file and `package-lock.json` changed
- WHEN a tool runs `specgate check --affected --json`
- THEN `selection.mode` is `full`, its `reason` names `package-lock.json`, and the tests stage ran `node run-tests.js` with no file

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-512 — When nothing maps, the whole suite runs, and says why

The system SHALL never run no test silently under `check --affected`: when nothing changed since the base, when no base can be found, when a changed file no requirement, test or import links to, or when the change links to no test file, it SHALL run the whole suite, with `selection.mode` `full` and a `reason` that says which of these it was.

#### Scenario: SCN-512a — Only an unlinked file changed

- GIVEN the project of SCN-510a on a branch where only `src/helpers.sql`, which no requirement, test or import names, changed
- WHEN a tool runs `specgate check --affected --json`
- THEN `selection.mode` is `full`, its `reason` names `src/helpers.sql` as linked to nothing, and the tests stage ran the whole suite

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-513 — The test command takes the selected files

The system SHALL fill `{files}` in the test command with the selected test files, each quoted for the platform's shell, and `{req}` with the touched requirement when there is exactly one; SHALL, under `check --affected`, run `test_cmd_affected:` from `harness.config.yaml` when it is set and `test_cmd` otherwise; and SHALL, when that command has neither placeholder, run it whole with `selection.mode` `full`, giving the finding `affected_needs_files` whose fix says how to add `{files}`. When the whole suite runs, `{files}` and `{req}` SHALL be empty.

#### Scenario: SCN-513a — A command with no placeholder, then a path with a space

- GIVEN the project of SCN-510a whose `test_cmd` is `node run-tests.js`, and REQ-001's test file at `test/my req.test.js`
- WHEN a tool runs `specgate check --affected --json`, then sets `test_cmd_affected` to `node run-tests.js {files}` and runs it again
- THEN the first answer has `selection.mode` `full` and the finding `affected_needs_files` naming `{files}`; the second ran `node run-tests.js` with `test/my req.test.js` as one argument

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-514 — The whole suite stays the default, and CI always runs it

The system SHALL run the whole suite on `specgate check` with no flag, as before, with `selection.mode` `full`; and on `specgate check --ci`, even with `--affected`, SHALL run the whole suite, never read or write the result cache, and give the finding `affected_ignored_ci`.

#### Scenario: SCN-514a — --ci with --affected

- GIVEN the project of SCN-510a on its branch
- WHEN a tool runs `specgate check --json`, then `specgate check --ci --affected --json`
- THEN both ran the whole suite with `selection.mode` `full`; the second has the finding `affected_ignored_ci` and no test file `cached`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-515 — apply runs the tests of the requirement it delivers

The system SHALL, when `specgate apply <REQ>` runs the tests, fill `{files}` with the test files the matrix links to that requirement — to the requirements given, when several are — and `{req}` as before; and SHALL use `test_cmd_affected` when it is set, and `test_cmd` otherwise.

#### Scenario: SCN-515a — apply with {files}

- GIVEN the project of SCN-510a with REQ-001 Approved and `test_cmd_affected` `node run-tests.js {files}`
- WHEN a person runs `specgate apply REQ-001`
- THEN REQ-001 is Implemented and the tests that ran were REQ-001's test file alone

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-516 — A test that passed on the same code is not run again

The system SHALL, under `check --affected` with a command that takes `{files}`, keep in the repository's git folder, beside the last gate result, each test file that passed with the hashes of its content and of the files it depends on — the code files the matrix links to its requirements and, in JavaScript and TypeScript, the files its relative imports reach, or every source file of the project when an import cannot be followed — under the test command, the lockfiles and the files every test depends on; SHALL not run again a selected test file whose hashes are all unchanged, listing it under `selection.cached` and saying so; and SHALL read and write nothing of it with `--no-cache` or `--ci`.

#### Scenario: SCN-516a — The same check twice, then a change to the code under test

- GIVEN the project of SCN-510a on its branch, where `specgate check --affected` passed
- WHEN `specgate check --affected --json` runs again, then REQ-001's source file changes and it runs a third time, then it runs with `--no-cache`
- THEN the second answer lists REQ-001's test file under `cached` and ran no test; the third ran it; the fourth ran it and cached nothing

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-517 — validate, status and matrix grow linearly with the project

The system SHALL keep the time `validate --strict`, `status --json` and `matrix --json` take about linear in the number of requirements: on generated projects of 500, 1,000 and 2,000 requirements, each with a feature, a test and a source file, each command on 2,000 SHALL take less than six times what it takes on 500 and finish within a budget a CI runner meets.

#### Scenario: SCN-517a — 500, 1,000 and 2,000 requirements

- GIVEN three generated projects of 500, 1,000 and 2,000 requirements in temporary folders
- WHEN the benchmark runs `validate --strict`, `status --json` and `matrix --json` on each
- THEN every run exits 0, and for each command the time on 2,000 is less than six times the time on 500

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-518 — The architecture check and the tests run side by side

The system SHALL, in `specgate check`, run `validate --strict` first and stop there when it fails; then run `arch_cmd` and the tests at the same time, each with its own output, and report both before the gate decides; then the quality checks by their `when:` stage, as before; and SHALL run them one after the other when `harness.config.yaml` sets `gate_parallel: false`.

#### Scenario: SCN-518a — Two stages of one second each

- GIVEN a project whose `arch_cmd` and `test_cmd` each wait one second, print a line and pass
- WHEN a tool runs `specgate check --json`, then sets `gate_parallel: false` and runs it again
- THEN the first answer's architecture and tests stages both passed and overlapped in time; the second's ran one after the other

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-519 — Each stage says how long it took

The system SHALL give each entry of `stages` in `specgate check --json`, and of the last result kept, `ms`: the milliseconds the stage took, or null for a stage that did not run; and SHALL show each stage's time on its line when the output is a terminal.

#### Scenario: SCN-519a — A passing check

- GIVEN a project whose test command waits a quarter of a second and passes
- WHEN a tool runs `specgate check --json`, then `specgate check --last --json`
- THEN the validate and tests stages have `ms` of at least 0 and 250, the architecture stage has `ms` null, and the last result gives the same

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
