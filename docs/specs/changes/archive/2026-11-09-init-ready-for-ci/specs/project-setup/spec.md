# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-455 — init installs the full gate, not specs.yml

The system SHALL, when `specgate init` creates a project or `specgate adopt` adopts one, write the CI gate `specgate ci init` writes for the provider it detects — GitHub when it detects none — instead of `.github/workflows/specs.yml`, with the specgate version that wrote it pinned; and SHALL write no CI file when `--no-ci` is given.

#### Scenario: SCN-455a — A new Node project gets the gate

- GIVEN an empty folder and specgate 0.31.0
- WHEN `specgate init --yes` creates a Node project there
- THEN `.github/workflows/spec-gate.yml` exists, runs `npx @rsaglobaltech/specgate@0.31.0 check`, and `.github/workflows/specs.yml` does not exist

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-456 — The gate is green on a project just created

The system SHALL generate a gate that passes on the project `init` just created; a step whose command is not configured yet — tests, architecture, quality — SHALL print that it is not configured and how to configure it, and SHALL not fail the run.

#### Scenario: SCN-456a — No test command yet

- GIVEN a project just created by `specgate init`, with no `test_cmd`
- WHEN its gate runs
- THEN every step passes, and the tests step prints that no test command is configured and `specgate config set test_cmd "<command>"`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-457 — Each step says what it checks and how to remove it

The system SHALL precede every step of the generated gate with a comment that says what it checks, the command it runs, and what to delete to remove it.

#### Scenario: SCN-457a — The matrix explained in the YAML

- GIVEN the gate `specgate init` wrote for GitHub
- WHEN the person reads the job's `strategy.matrix`
- THEN the comment above it says it runs the gate on Ubuntu, macOS and Windows, and that deleting `macos-latest` and `windows-latest` keeps Ubuntu only

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-458 — More validations by default

The system SHALL include in the generated GitHub gate, by default: the gate on Ubuntu, macOS and Windows; the requirement ids compared with the base branch (a full-history checkout and `check --base`); the quality checks when `harness.config.yaml` configures them (`specgate quality init`), on Ubuntu, where Docker runs; the pack drift check; and the pending-work plan as an artifact.

#### Scenario: SCN-458a — The ids compared with the base branch

- GIVEN a project whose main branch is `main`
- WHEN `specgate ci init --provider github` writes its gate
- THEN the checkout uses `fetch-depth: 0` and the gate runs `check --base origin/main` on `ubuntu-latest`, `macos-latest` and `windows-latest`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-459 — A minimal gate, for those who want one

The system SHALL, with `specgate ci init --minimal`, write a gate with one job on Ubuntu that runs only `specgate check`, with the version pinned.

#### Scenario: SCN-459a — One step

- GIVEN a project with no CI file
- WHEN `specgate ci init --provider github --minimal` runs
- THEN `.github/workflows/spec-gate.yml` has one job on `ubuntu-latest` whose only specgate step is `check`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-460 — ci status says what the gate checks and what it lacks

The system SHALL, with `specgate ci status`, read the project's CI file and list each validation specgate knows as present or missing, and for a missing one the line that adds it.

#### Scenario: SCN-460a — An old specs.yml

- GIVEN a project whose only CI file is the old `specs.yml` running `validate .`
- WHEN `specgate ci status` runs
- THEN it lists the specification as present, and the tests, the architecture, the three systems, the ids against the base, the pack drift and the plan as missing, each with how to add it

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-461 — An old specs.yml replaced only after showing the difference

The system SHALL, when `specgate ci init` finds the `specs.yml` an older `init` wrote, show what the new gate adds and replace it only with `--replace`; without it, SHALL write nothing and say how to replace it.

#### Scenario: SCN-461a — Without --replace

- GIVEN a project with the old `.github/workflows/specs.yml`
- WHEN `specgate ci init --provider github` runs
- THEN it lists what the gate would add, writes no file, and says `specgate ci init --provider github --replace`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-462 — The README names only what was written

The system SHALL write a README that lists only the files `init` wrote for the chosen architecture profile, and that names `specgate check` as the command that validates the project.

#### Scenario: SCN-462a — The layered profile

- GIVEN `specgate init` with `ARCHITECTURE: layered`
- WHEN the project is created
- THEN its README lists `docs/specs/use-cases.md`, does not list `domain-model.md`, `commands.md`, `events.md`, `aggregates.md`, `status-model.md` or `AI_RULES.md`, and names `specgate check`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-463 — The container scaffold only for a service

The system SHALL write the `.env.*` files, `docker-compose.yml`, `.dockerignore`, the devcontainer and the container `runtime-environments.md` only for a project type that runs as a service (`backend`, `frontend`); for a `mobile` or `desktop` project SHALL write a `runtime-environments.md` for an app that runs on the person's device, and none of those files.

#### Scenario: SCN-463a — A desktop project

- GIVEN `specgate init` with `PROJECT_TYPE: desktop`
- WHEN the project is created
- THEN it has no `.env.dev`, `docker-compose.yml`, `.dockerignore` or `.devcontainer/`, and its `runtime-environments.md` describes a local app

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-464 — A project type for desktop apps

The system SHALL accept `desktop` as a project type, with stack rules for a desktop app — the window, a sidecar process, signed installers, auto-update — in its AGENTS.md.

#### Scenario: SCN-464a — A Tauri app

- GIVEN `specgate init` with `PROJECT_TYPE: desktop` and `STACK: Tauri 2, TypeScript`
- WHEN the project is created
- THEN its AGENTS.md says `desktop project` and its project rules name installers and auto-update

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
