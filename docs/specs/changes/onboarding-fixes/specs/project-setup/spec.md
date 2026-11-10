# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-470 — Adopt saves what it detects and says what is ready

The system SHALL, when `specgate adopt` adopts a project, save the test command it detects as `test_cmd` — when the project declares it (a `test` script) or has test files; a project with neither is told no test was found yet, with the command to set it later — and, when an agent's CLI is on the PATH, the command Build runs it with as `agent` — asking before each when a person is at the terminal, applying them with `--yes` or without a terminal, never replacing a value already set — and SHALL end with one readiness list that says, for the tests, the agent, the architecture check and the CI gate, whether each is set and the command that sets it.

#### Scenario: SCN-470a — A Node project adopted with --yes

- GIVEN a local Node project whose package.json has a `test` script, and no specgate files
- WHEN the developer runs `specgate adopt --yes`
- THEN `harness.config.yaml` has `test_cmd: npm test`, `specgate check` runs `npm test`, and the readiness list shows the tests as set and the architecture check as not set with `specgate config set arch_cmd "<command>"`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-471 — The areas adopt finds are not requirements

The system SHALL write the areas `adopt` reads off the code — each with the folder it comes from, its number of source files and the test files under it — to `docs/specs/adoption.md`, with the command that specifies one, and SHALL add none of them to spec.md or the traceability matrix, which start with the adoption baseline alone.

#### Scenario: SCN-471a — Four areas found in an existing project

- GIVEN a local project with code under `src/auth`, `src/catalog`, `src/orders` and `src/payments`, and tests under `test/auth`
- WHEN the developer adopts it
- THEN `docs/specs/adoption.md` lists the four areas with their folders, file counts and `test/auth/auth.test.js` under Auth, the matrix has only REQ-001, and `status` shows one requirement

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-472 — An earlier adoption's unspecified proposals are flagged

The system SHALL, in a project adopted before REQ-471, report each requirement still marked "Proposed, not specified" in `status` and `doctor`, with the code `proposal_unspecified` and the fix: specify it, or remove its section.

#### Scenario: SCN-472a — REQ-002 "Auth" left from an earlier adoption

- GIVEN a project whose spec.md has REQ-002 "Auth" marked "Proposed, not specified", with a `TBD` test
- WHEN the developer runs `specgate status --json`
- THEN its findings include `proposal_unspecified` for REQ-002, whose fix names `specgate new` and removing the section

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-473 — One command sets up the agent

The system SHALL, when `specgate agents init --tool <tool>` installs an agent's commands and Build's `agent` is not set, also set `agent` to the command that runs that tool non-interactively.

#### Scenario: SCN-473a — Claude Code set up once

- GIVEN an adopted project with no `agent` set
- WHEN the developer runs `specgate agents init --tool claude`
- THEN the Claude Code commands are installed and `specgate config get agent` answers the Claude Code command that reads `-p < {prompt_file}`, as `config set agent` saves it

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-475 — One short page to start

The system SHALL publish one Start page with two paths — an existing project and a new one — each in at most six steps that each name the command to run, and the documentation's other start pages SHALL point to it instead of repeating it.

#### Scenario: SCN-475a — Starting with an existing local project

- GIVEN a developer with an existing local project and the documentation site
- WHEN they open the Start page from the home page
- THEN the existing-project path shows at most six steps, each with its command, from installing specgate to the first applied requirement, and getting-started and quickstart point to it

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
