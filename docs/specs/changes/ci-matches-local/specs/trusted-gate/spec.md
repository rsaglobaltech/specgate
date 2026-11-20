# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-613 — After adoption CI runs the test command the project saved

The system SHALL, when `adopt` detects the test command, add `npm run build` to an `npm` command of a project with a `build` script, print, save as `test_cmd` and state in `AGENTS.md` that one command, and take a command given with `--var TEST_CMD` as written; SHALL, when it wrote the CI file and saved `test_cmd` in the same run, have the job run `check .` with no `--test-cmd`; SHALL leave a CI file that was already there as it is; and SHALL, when the repository has no agent folder, say `Agent commands: not installed`.

#### Scenario: SCN-613a — A build script

- GIVEN a project whose `package.json` has `test` and `build` scripts
- WHEN the developer runs `specgate adopt`
- THEN it prints `Test command: npm test && npm run build`, `harness.config.yaml` holds that as `test_cmd`, `AGENTS.md` states it, and the job runs `check . --base` with no `--test-cmd`

#### Scenario: SCN-613b — No build script, and a command given

- GIVEN a project with a `test` script only, and another with `test` and `build` adopted with `--var TEST_CMD="npm test"`
- WHEN the developer runs `specgate adopt` in each
- THEN both save `test_cmd: "npm test"`, and the first job has no `--test-cmd`

#### Scenario: SCN-613c — A CI file already there

- GIVEN a project whose `.github/workflows/spec-gate.yml` says `# ours`
- WHEN the developer runs `specgate adopt`
- THEN the file still says `# ours`

#### Scenario: SCN-613d — The agent's commands

- GIVEN a project with no agent folder
- WHEN the developer runs `specgate adopt`
- THEN it says `Agent commands: not installed` and not `Agent: none detected`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-613.feature kind=functional status=Approved -->
