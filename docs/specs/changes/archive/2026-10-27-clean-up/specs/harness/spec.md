# Delta — harness

## ADDED Requirements

### Requirement: REQ-196 — The harness and its tests work on Windows

The system SHALL write Cucumber's message stream to a path with forward slashes on every platform, so the gate reads what the run did on Windows too; its test suite SHALL pass on Windows, stopping studio's whole process tree before removing a project and removing the temporary folders it makes, with retries; and `docs:terminal` and `docs:journey` SHALL say they need a POSIX shell instead of failing at `git init` on Windows, recording with the spec reporter whatever the Node version.

#### Scenario: SCN-196a — A Cucumber filter that matches nothing fails the gate on Windows

- GIVEN a test command `npx cucumber-js --tags "@does-not-exist"`
- WHEN the harness runs the gate on Windows
- THEN it fails at "cucumber messages", as on Linux

<!-- specgate:trace status=Implemented test=tests/unit/harness-run.test.ts actor=Developer kind=non-functional -->

### Requirement: REQ-198 — A requirement an open change modifies is reworked

The system SHALL give the harness a requirement that an open change modifies, and whose tests already exist, as NEEDS_REWORK instead of NEEDS_STATUS_UPDATE, and its prompt SHALL say its tests and code are for the old text and must be brought to the new one, tests first.

#### Scenario: SCN-198a — Modified with tests needs rework

- GIVEN REQ-017 is modified by an open change and has tests
- WHEN the harness reads the plan
- THEN REQ-017 is NEEDS_REWORK, and the in-flight view says the change modifies it

#### Scenario: SCN-198b — The prompt says what changed

- GIVEN REQ-017 is NEEDS_REWORK
- WHEN its prompt is built
- THEN it says the tests and code are for the old text and the tests must fail against the current behaviour first

<!-- specgate:trace status=Implemented test=packages/core/test/unit/rework.test.ts actor=Developer kind=functional -->

### Requirement: REQ-199 — A requirement used on a screen needs an e2e test

The system SHALL read `e2e_dir` from harness.config.yaml and, for a requirement whose own `surfaces=` or whose actor's surfaces in the brief include web, mobile, tablet or desktop, SHALL fail the gate at "e2e test" until a file under that folder names the requirement, and SHALL say so in its prompt.

#### Scenario: SCN-199a — On a screen by its surfaces or its actor's

- GIVEN the brief gives the Fahrschüler the web and Sistema the api, and REQ-024 says surfaces=mobile
- WHEN their surfaces are read
- THEN REQ-022 of the Fahrschüler and REQ-024 are on a screen and REQ-023 of Sistema is not

#### Scenario: SCN-199b — The prompt asks for the e2e test

- GIVEN e2e_dir is apps/web/e2e and REQ-022 is on a screen
- WHEN its prompt is built
- THEN it asks for an end-to-end test under apps/web/e2e that names REQ-022

#### Scenario: SCN-199c — The gate waits for the e2e test

- GIVEN e2e_dir is e2e and REQ-000 is on the web
- WHEN the agent writes only code, then also e2e/health.spec.js naming REQ-000
- THEN the first run fails with "No file under e2e names REQ-000" and the second does not

<!-- specgate:trace status=Implemented test=tests/unit/screen-requirements.test.ts actor=Developer kind=functional -->

### Requirement: REQ-200 — The harness template shows the streaming agent

The system's harness.config.yaml template and agent guide SHALL show the Claude Code command that streams to studio's live view, and the `e2e_dir` key.

#### Scenario: SCN-200a — The template proposes the streaming command

- GIVEN `specgate harness init`
- WHEN it writes harness.config.yaml
- THEN the file shows `claude -p --output-format stream-json --verbose … | specgate harness events --from claude` and `e2e_dir`

<!-- specgate:trace status=Implemented test=tests/unit/harness-init.test.ts actor=Developer kind=functional -->
