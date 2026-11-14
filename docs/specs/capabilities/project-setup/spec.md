# Project Setup

## Requirements

### Requirement: REQ-455 — init installs the full gate, not specs.yml

The system SHALL, when `specgate init` creates a project or `specgate adopt` adopts one, write the CI gate `specgate ci init` writes for the provider it detects — GitHub when it detects none — instead of `.github/workflows/specs.yml`, with the specgate version that wrote it pinned; and SHALL write no CI file when `--no-ci` is given.

#### Scenario: SCN-455a — A new Node project gets the gate

- GIVEN an empty folder and specgate 0.31.0
- WHEN `specgate init --yes` creates a Node project there
- THEN `.github/workflows/spec-gate.yml` exists, runs `npx @rsaglobaltech/specgate@0.31.0 check`, and `.github/workflows/specs.yml` does not exist

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-455.feature kind=functional status=Implemented -->

### Requirement: REQ-456 — The gate is green on a project just created

The system SHALL generate a gate that passes on the project `init` just created; a step whose command is not configured yet — tests, architecture, quality — SHALL print that it is not configured and how to configure it, and SHALL not fail the run.

#### Scenario: SCN-456a — No test command yet

- GIVEN a project just created by `specgate init`, with no `test_cmd`
- WHEN its gate runs
- THEN every step passes, and the tests step prints that no test command is configured and `specgate config set test_cmd "<command>"`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-456.feature kind=functional status=Implemented -->

### Requirement: REQ-457 — Each step says what it checks and how to remove it

The system SHALL precede every step of the generated gate with a comment that says what it checks, the command it runs, and what to delete to remove it.

#### Scenario: SCN-457a — The matrix explained in the YAML

- GIVEN the gate `specgate init` wrote for GitHub
- WHEN the person reads the job's `strategy.matrix`
- THEN the comment above it says it runs the gate on Ubuntu, macOS and Windows, and that deleting `macos-latest` and `windows-latest` keeps Ubuntu only

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-457.feature kind=functional status=Implemented -->

### Requirement: REQ-458 — More validations by default

The system SHALL include in the generated GitHub gate, by default: the gate on Ubuntu, macOS and Windows; the requirement ids compared with the base branch (a full-history checkout and `check --base`); the quality checks when `harness.config.yaml` configures them (`specgate quality init`), on Ubuntu, where Docker runs; the pack drift check; and the pending-work plan as an artifact.

#### Scenario: SCN-458a — The ids compared with the base branch

- GIVEN a project whose main branch is `main`
- WHEN `specgate ci init --provider github` writes its gate
- THEN the checkout uses `fetch-depth: 0` and the gate runs `check --base origin/main` on `ubuntu-latest`, `macos-latest` and `windows-latest`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-458.feature kind=functional status=Implemented -->

### Requirement: REQ-459 — A minimal gate, for those who want one

The system SHALL, with `specgate ci init --minimal`, write a gate with one job on Ubuntu that runs only `specgate check`, with the version pinned.

#### Scenario: SCN-459a — One step

- GIVEN a project with no CI file
- WHEN `specgate ci init --provider github --minimal` runs
- THEN `.github/workflows/spec-gate.yml` has one job on `ubuntu-latest` whose only specgate step is `check`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-459.feature kind=functional status=Implemented -->

### Requirement: REQ-460 — ci status says what the gate checks and what it lacks

The system SHALL, with `specgate ci status`, read the project's CI file and list each validation specgate knows as present or missing, and for a missing one the line that adds it.

#### Scenario: SCN-460a — An old specs.yml

- GIVEN a project whose only CI file is the old `specs.yml` running `validate .`
- WHEN `specgate ci status` runs
- THEN it lists the specification as present, and the tests, the architecture, the three systems, the ids against the base, the pack drift and the plan as missing, each with how to add it

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-460.feature kind=functional status=Implemented -->

### Requirement: REQ-461 — An old specs.yml replaced only after showing the difference

The system SHALL, when `specgate ci init` finds the `specs.yml` an older `init` wrote, show what the new gate adds and replace it only with `--replace`; without it, SHALL write nothing and say how to replace it.

#### Scenario: SCN-461a — Without --replace

- GIVEN a project with the old `.github/workflows/specs.yml`
- WHEN `specgate ci init --provider github` runs
- THEN it lists what the gate would add, writes no file, and says `specgate ci init --provider github --replace`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-461.feature kind=functional status=Implemented -->

### Requirement: REQ-462 — The README names only what was written

The system SHALL write a README that lists only the files `init` wrote for the chosen architecture profile, and that names `specgate check` as the command that validates the project.

#### Scenario: SCN-462a — The layered profile

- GIVEN `specgate init` with `ARCHITECTURE: layered`
- WHEN the project is created
- THEN its README lists `docs/specs/use-cases.md`, does not list `domain-model.md`, `commands.md`, `events.md`, `aggregates.md`, `status-model.md` or `AI_RULES.md`, and names `specgate check`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-462.feature kind=functional status=Implemented -->

### Requirement: REQ-463 — The container scaffold only for a service

The system SHALL write the `.env.*` files, `docker-compose.yml`, `.dockerignore`, the devcontainer and the container `runtime-environments.md` only for a project type that runs as a service (`backend`, `frontend`); for a `mobile` or `desktop` project SHALL write a `runtime-environments.md` for an app that runs on the person's device, and none of those files.

#### Scenario: SCN-463a — A desktop project

- GIVEN `specgate init` with `PROJECT_TYPE: desktop`
- WHEN the project is created
- THEN it has no `.env.dev`, `docker-compose.yml`, `.dockerignore` or `.devcontainer/`, and its `runtime-environments.md` describes a local app

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-463.feature kind=functional status=Implemented -->

### Requirement: REQ-464 — A project type for desktop apps

The system SHALL accept `desktop` as a project type, with stack rules for a desktop app — the window, a sidecar process, signed installers, auto-update — in its AGENTS.md.

#### Scenario: SCN-464a — A Tauri app

- GIVEN `specgate init` with `PROJECT_TYPE: desktop` and `STACK: Tauri 2, TypeScript`
- WHEN the project is created
- THEN its AGENTS.md says `desktop project` and its project rules name installers and auto-update

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-464.feature kind=functional status=Implemented -->

### Requirement: REQ-528 — reverse lists the modules of an existing system

The system SHALL, with `specgate reverse --modules [--json]`, list the candidate modules of the project — Maven or Gradle modules, npm workspaces, Go packages, and the first-level folders under `src/` or `apps/` that hold source files — each with its `path`, its detected `stack` and its `files` count, sorted by path; SHALL run no agent; and SHALL answer `no_modules` with the fix `specgate reverse <path>` when it finds none.

#### Scenario: SCN-528a — A Maven project with two modules

- GIVEN a git project whose `pom.xml` declares the modules `orders` and `billing`, each with Java sources
- WHEN a tool runs `specgate reverse --modules --json`
- THEN it exits 0 and `modules` lists `billing` then `orders`, each with `stack` `java` and its file count, and no agent was started

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-528.feature kind=functional status=Implemented -->

### Requirement: REQ-529 — reverse drafts one module into a change

The system SHALL, with `specgate reverse <module> [--agent <cmd>] [--json]`, run the configured agent with a prompt built from the module's source, tests and schema files, undo every write the agent makes outside its answer file, and write what it answers into a change `docs/specs/changes/reverse-<module>/` with reserved REQ ids; every requirement in it SHALL have the status `Draft`; `spec.md` and the capability specs SHALL not change; and the change SHALL pass `specgate change validate`, else the command SHALL answer the validation findings and keep nothing.

#### Scenario: SCN-529a — The agent drafts the orders module

- GIVEN the project of SCN-528a and an agent that answers two requirements with one scenario each for `orders`
- WHEN a tool runs `specgate reverse orders --json`
- THEN it exits 0, `docs/specs/changes/reverse-orders/` holds a delta with the two requirements, both `Draft`, and `spec.md` is unchanged

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-529.feature kind=functional status=Implemented -->

### Requirement: REQ-530 — A reversed requirement cites its evidence

The system SHALL record, in the trace comment of each requirement `reverse` writes, a `source=` list of the files and lines it was read from; `specgate validate` SHALL warn `source_missing` for a cited file that does not exist, without failing; and the system SHALL write behaviour the agent marks as suspect — a defect, not a rule — as a question in the change's `questions.md`, never as a requirement.

#### Scenario: SCN-530a — A rule, a defect and a deleted file

- GIVEN an agent that reverses `orders` into one requirement citing `src/orders/Cancel.java:12` and one behaviour it marks as suspect
- WHEN a tool runs `specgate reverse orders --json`, deletes `src/orders/Cancel.java`, then runs `specgate validate --json`
- THEN the delta has one requirement whose trace carries `source=src/orders/Cancel.java:12`, `questions.md` has one question for the suspect behaviour, and `validate` reports `source_missing` naming the deleted file

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-530.feature kind=functional status=Implemented -->

### Requirement: REQ-531 — A baseline lets an existing project adopt the gate

The system SHALL, with `specgate check --baseline`, write the gate's current findings to `docs/specs/gate-baseline.json`, each as a fingerprint of its code, file and requirement id; later `specgate check` and `specgate validate` runs SHALL fail only on findings absent from that file, SHALL report the baselined ones as `baselined` with their count, and SHALL report `baseline_fixed` for a baselined finding that no longer occurs so the file can shrink.

#### Scenario: SCN-531a — An old finding passes, a new one fails

- GIVEN a project where REQ-001 is `Implemented` with no test that names it, and `specgate check --baseline` has run
- WHEN REQ-002 is set `Implemented` with no test that names it and a tool runs `specgate check --json`
- THEN it fails with one finding for REQ-002, and reports REQ-001's finding as `baselined`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-531.feature kind=functional status=Implemented -->
