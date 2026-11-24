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

### Requirement: REQ-561 — A reversed module is a layered change

The system SHALL write the change `specgate reverse <module>` drafts in the three layers (ADR-0044): `discover.md` saying what was read and the criteria a person confirms, `design.md` naming the module, `tasks.md` with one task per drafted requirement naming it, and `schema: layered` — and SHALL write no `proposal.md`; the change SHALL pass `specgate change validate --strict`.

#### Scenario: SCN-561a — A reversed module is a layered change

- GIVEN a Maven project whose module `orders` an agent reads into two requirements
- WHEN a developer runs `specgate reverse orders`
- THEN the change has discover.md, design.md and tasks.md naming both requirements, `schema: layered`, no proposal.md, and `change validate --strict` passes

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-561.feature kind=functional status=Implemented -->

### Requirement: REQ-470 — Adopt saves what it detects and says what is ready

The system SHALL, when `specgate adopt` adopts a project, save the test command it detects as `test_cmd` — when the project declares it (a `test` script) or has test files; a project with neither is told no test was found yet, with the command to set it later — and, when an agent's CLI is on the PATH, the command Build runs it with as `agent` — asking before each when a person is at the terminal, applying them with `--yes` or without a terminal, never replacing a value already set — and SHALL end with one readiness list that says, for the tests, the agent, the architecture check and the CI gate, whether each is set and the command that sets it.

#### Scenario: SCN-470a — A Node project adopted with --yes

- GIVEN a local Node project whose package.json has a `test` script, and no specgate files
- WHEN the developer runs `specgate adopt --yes`
- THEN `harness.config.yaml` has `test_cmd: npm test`, `specgate check` runs `npm test`, and the readiness list shows the tests as set and the architecture check as not set with `specgate config set arch_cmd "<command>"`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-470.feature kind=functional status=Implemented -->

### Requirement: REQ-471 — The areas adopt finds are not requirements

The system SHALL write the areas `adopt` reads off the code — each with the folder it comes from, its number of source files and the test files under it — to `docs/specs/adoption.md`, with the command that specifies one, and SHALL add none of them to spec.md or the traceability matrix, which start with the adoption baseline alone.

#### Scenario: SCN-471a — Four areas found in an existing project

- GIVEN a local project with code under `src/auth`, `src/catalog`, `src/orders` and `src/payments`, and tests under `test/auth`
- WHEN the developer adopts it
- THEN `docs/specs/adoption.md` lists the four areas with their folders, file counts and `test/auth/auth.test.js` under Auth, the matrix has only REQ-001, and `status` shows one requirement

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-471.feature kind=functional status=Implemented -->

### Requirement: REQ-472 — An earlier adoption's unspecified proposals are flagged

The system SHALL, in a project adopted before REQ-471, report each requirement still marked "Proposed, not specified" in `status` and `doctor`, with the code `proposal_unspecified` and the fix: specify it, or remove its section.

#### Scenario: SCN-472a — REQ-002 "Auth" left from an earlier adoption

- GIVEN a project whose spec.md has REQ-002 "Auth" marked "Proposed, not specified", with a `TBD` test
- WHEN the developer runs `specgate status --json`
- THEN its findings include `proposal_unspecified` for REQ-002, whose fix names `specgate new` and removing the section

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-472.feature kind=functional status=Implemented -->

### Requirement: REQ-473 — One command sets up the agent

The system SHALL, when `specgate agents init --tool <tool>` installs an agent's commands and Build's `agent` is not set, also set `agent` to the command that runs that tool non-interactively.

#### Scenario: SCN-473a — Claude Code set up once

- GIVEN an adopted project with no `agent` set
- WHEN the developer runs `specgate agents init --tool claude`
- THEN the Claude Code commands are installed and `specgate config get agent` answers the Claude Code command that reads `-p < {prompt_file}`, as `config set agent` saves it

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-473.feature kind=functional status=Implemented -->

### Requirement: REQ-475 — One short page to start

The system SHALL publish one Start page with two paths — an existing project and a new one — each in at most six steps that each name the command to run, and the documentation's other start pages SHALL point to it instead of repeating it.

#### Scenario: SCN-475a — Starting with an existing local project

- GIVEN a developer with an existing local project and the documentation site
- WHEN they open the Start page from the home page
- THEN the existing-project path shows at most six steps, each with its command, from installing specgate to the first applied requirement, and getting-started and quickstart point to it

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-475.feature kind=functional status=Implemented -->

### Requirement: REQ-489 — adopt --dry-run lists what adopt --yes writes

The system SHALL list in `specgate adopt --dry-run` every file `specgate adopt --yes` would write in the same folder, and no other: README.md and .gitattributes when it would write them, harness.config.yaml when it would save a detected command, the agents' files it would install, and the CI gate only when it would write it.

#### Scenario: SCN-489a — A Node project with no README.md

- GIVEN two copies of a Node project with a `test` script, no README.md and no .gitattributes
- WHEN `specgate adopt --dry-run` runs on one and `specgate adopt --yes` on the other
- THEN the files the dry run lists are exactly the files the other run wrote, README.md and .gitattributes among them, and the first copy is unchanged

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-489.feature kind=functional status=Implemented -->

### Requirement: REQ-505 — config says the file each setting is kept in

The system SHALL answer `specgate config get`, `config set` and `config list` with `--json` with `files` beside `config`: for each key in the answer, the file it is kept in, relative to the project with forward slashes — `.specgate/config.json`, `harness.config.yaml`, `.harness/profiles.yaml` or `alm.config.yaml`.

#### Scenario: SCN-505a — test_cmd and pet

- GIVEN a project where `specgate config set test_cmd "npm test"` and `specgate config set pet off` have run
- WHEN a tool runs `specgate config list --json` and `specgate config get pet --json`
- THEN the list has `files.test_cmd` `harness.config.yaml` and `files.pet` `.specgate/config.json`, and the get has `files.pet` `.specgate/config.json`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-505.feature kind=functional status=Implemented -->

### Requirement: REQ-506 — A catalog of every setting

The system SHALL list with `specgate config keys --json` every key `config set` accepts, each with its `key`, `description`, allowed `values` or null, the `pattern` its value must match or null, its `default` or null, its `current` value in the project or null, and its `file`; a key with a name inside it — a profile's or a check's — SHALL be listed once with `<name>` in its place and once more for each name the project already has.

#### Scenario: SCN-506a — The catalog of a project with one profile

- GIVEN a project with `test_cmd: npm test` and the profile `fast` in `.harness/profiles.yaml`
- WHEN a tool runs `specgate config keys --json`
- THEN `test_cmd` has `current` `npm test` and `file` `harness.config.yaml`, `pet` has `values` `on` and `off` and `default` `on`, and both `profiles.<name>.agent` and `profiles.fast.agent` are listed with the file `.harness/profiles.yaml`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-506.feature kind=functional status=Implemented -->

### Requirement: REQ-507 — config set writes agent profiles

The system SHALL accept `specgate config set profiles.<name>.<field> <value>` for the fields `agent`, `advisory`, `cost_per_run_hint`, `price_per_input_token`, `price_per_output_token`, `price_per_cache_read_token` and `price_per_cache_write_token`, writing them to the profile in `.harness/profiles.yaml` — creating the file or the profile when missing and keeping every other line — and `agent_profile`, the profile `harness run` uses by default, in `harness.config.yaml`; and SHALL refuse with `config_value_invalid` and a fix an agent without `{prompt_file}`, an `advisory` that is not `true` or `false`, a cost or price that is not a number of zero or more, a profile name that is not letters, digits, `-` and `_`, and an `agent_profile` that names no declared profile.

#### Scenario: SCN-507a — A profile written, then a bad price refused

- GIVEN a project with no `.harness/profiles.yaml`
- WHEN a tool runs `specgate config set profiles.fast.agent "claude -p < {prompt_file}"` and `specgate config set profiles.fast.price_per_input_token 0.000003`, then `specgate config set profiles.fast.price_per_output_token cheap --json`
- THEN `.harness/profiles.yaml` declares `fast` with that agent and price, which `harness run --profile fast` reads; the last exits 2 with `config_value_invalid` and a fix, and the file is unchanged

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-507.feature kind=functional status=Implemented -->

### Requirement: REQ-508 — config set writes quality checks and ALM settings, never a credential

The system SHALL accept `specgate config set` for `quality`, `diff_coverage` and `mutation_score` and for `checks.<name>.<field>` — a check's `run`, `when`, `gate`, `runner`, `image`, `timeout`, `sarif`, `report`, `scope`, `env`, `profile`, `needs`, `network`, `shell` and `docker` — in `harness.config.yaml`, a check created by setting its `run`; and for `alm.<key>` and `alm.pr.<key>` in `alm.config.yaml`, created with `alm_version: 1` when missing; each value checked as the file's reader checks it and refused with `config_value_invalid` and a fix, leaving the file as it was. A key ending in `_env` SHALL take only the name of an environment variable — capitals, digits and `_` — and no key SHALL store a token or password.

#### Scenario: SCN-508a — A check, the Jira settings and a token refused

- GIVEN a project with `harness.config.yaml`
- WHEN a tool runs `specgate config set checks.lint.run "npm run lint"`, `config set checks.lint.when end`, `config set alm.provider jira` and `config set alm.token_env JIRA_TOKEN`, then `config set alm.token_env "ATATT3xFfGF0abc=123" --json` and `config set checks.lint.when later --json`
- THEN `specgate quality list --json` shows the check `lint` at `end`, `alm.config.yaml` has `provider: jira` and `token_env: JIRA_TOKEN`, and the last two exit 2 with `config_value_invalid` and a fix, the first saying to name the variable that holds the token, with both files unchanged

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-508.feature kind=functional status=Implemented -->

### Requirement: REQ-476 — Folders named by the kind of code are not areas

The system SHALL, when `onboard` and `adopt` read areas off a directory's children, leave out each child named by a generic kind of code — components, hooks, helpers, types, styles, store, utils, lib, shared and the others ADR-0041 lists — and SHALL propose no area from a directory where at least two children, and at least half of them, are named by a kind of code, the architectural layers included: that directory is organised by kind of code, not by what the product does. A layer name alone, such as `core` beside real areas, stays an area.

#### Scenario: SCN-476a — A React CLI split by kind of code

- GIVEN a TypeScript project whose `src/` holds `components`, `keymap`, `hooks`, `utils` and `data`
- WHEN the developer runs `specgate onboard`, then `specgate adopt --yes`
- THEN `onboard` proposes no area and says the code is organised by kind, `adopt` writes no `docs/specs/adoption.md`, and spec.md has REQ-001 alone

#### Scenario: SCN-476b — Areas beside a utils folder

- GIVEN a project whose `src/` holds `billing`, `invoices` and `utils`
- WHEN the developer runs `specgate onboard`
- THEN it proposes the areas Billing and Invoices, and not Utils

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-476.feature kind=business-rule status=Implemented -->

### Requirement: REQ-477 — After adoption, onboard points at one behaviour, not a folder

The system SHALL, when `onboard` runs on an adopted project, name `specgate new "<a behaviour you rely on>"` as the next command — with `docs/specs/adoption.md` when adoption found areas — and never a change named after a folder.

#### Scenario: SCN-477a — onboard on an adopted project with areas

- GIVEN a project adopted with the areas Billing and Invoices
- WHEN the developer runs `specgate onboard --json`
- THEN its next command is `specgate new "<a behaviour you rely on>"`, not `specgate propose describe-billing`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-477.feature kind=functional status=Implemented -->

### Requirement: REQ-478 — The adoption baseline names no path that is not one

The system SHALL seed the adoption baseline REQ-001 with no test and no code artifact, rather than the test command and the words "existing codebase" in their place, so that `plan` reports no missing file for it; it is closed, as any requirement, once a test names REQ-001, and `harness run` takes it only when it is named with `--req`, since an agent cannot build existing behaviour.

#### Scenario: SCN-478a — plan right after adoption

- GIVEN a Node project just adopted
- WHEN the developer runs `specgate plan --format json`
- THEN no finding names `npm test` or `existing codebase` as a missing file for REQ-001

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-478.feature kind=functional status=Implemented -->

### Requirement: REQ-608 — A folder with no code is adopted as a new project

The system SHALL, when `adopt` finds neither a build manifest nor a source file, say that the folder has no code yet, state `new project` and `API: TBD` in the header of `AGENTS.md`, and write as REQ-001 "The project builds and its tests run", with a scenario and a matrix row to match, in place of the requirement to preserve existing behaviour; SHALL, in that project, have `check` pass and `status` say to add the first thing the product should do; and SHALL, when the folder has a manifest or a source file, adopt it as an existing project whose REQ-001 preserves existing behaviour, stating its API as `as built` unless `--var API_STYLE` says otherwise.

#### Scenario: SCN-608a — An empty folder

- GIVEN an empty folder
- WHEN the developer runs `specgate adopt`, then `specgate check` and `specgate status`
- THEN adopt says `No code here yet: set up as a new project`, `AGENTS.md` says `new project` and `Stack: TBD · API: TBD · Testing: TBD`, `spec.md` has `REQ-001 — The project builds and its tests run` and names neither brownfield nor REST, `check` exits 0, and `status` says `add the first thing the product should do`

#### Scenario: SCN-608b — A folder with code

- GIVEN a folder with a `package.json` and `src/a.js`
- WHEN the developer runs `specgate adopt`
- THEN `AGENTS.md` says `existing project` and `API: as built`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`

#### Scenario: SCN-608c — Sources with no manifest

- GIVEN a folder holding only `src/main.py`
- WHEN the developer runs `specgate adopt --var API_STYLE=GraphQL`
- THEN `AGENTS.md` says `existing project` and `Stack: TBD · API: GraphQL`, and `spec.md` has `REQ-001 — Existing behaviour is preserved`

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-608.feature kind=functional status=Implemented -->

### Requirement: REQ-609 — A plain init in an empty folder chooses nothing for the person

The system SHALL, when `specgate init` runs with no flag naming the project to create in a folder with no code, offer in a terminal three starts — `1` an application generated by forja, `2` the specification only in that folder, `3` a project from a template — taking Enter as `2`; SHALL, for `2`, and with no terminal, write in that folder what `adopt` writes for a folder with no code, exit 0, and with no terminal name `specgate init --yes` and `specgate init --forja`; and SHALL, when `specgate init --yes` scaffolds, say the folder the project goes in, warn that `--yes` took every default naming the project type, the stack and `specgate config set stack`, and end with `cd <folder> && specgate status`, writing the project it wrote before.

#### Scenario: SCN-609a — No terminal, no flags

- GIVEN an empty folder and no terminal
- WHEN `specgate init` runs, then `specgate check`
- THEN init exits 0 saying `writing the specification only, in this folder` and naming `specgate init --yes` and `specgate init --forja`, `AGENTS.md` in that folder says `new project` and `Stack: TBD · API: TBD · Testing: TBD`, no `my-spec-driven-app` folder exists, and `check` exits 0

#### Scenario: SCN-609b — Every default

- GIVEN an empty folder
- WHEN `specgate init --yes --no-git` runs
- THEN it says `the project goes in a new folder here: my-spec-driven-app/`, warns `--yes took every default: a backend project on Java 21`, names `specgate config set stack`, ends with `cd my-spec-driven-app && specgate status`, and `my-spec-driven-app/spec.md` exists

#### Scenario: SCN-609c — The three answers

- GIVEN the question `What are you starting?`
- WHEN the person answers nothing, `2`, `1`, `3` and `4`
- THEN the starts are the specification only, the specification only, forja, a template, and the question again

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-609.feature kind=functional status=Implemented -->

### Requirement: REQ-607 — An undecided stack names the way to decide it

The system SHALL, when `adopt` finds no build manifest, state `Stack` and `Testing` in the header of `AGENTS.md` as `TBD`, and SHALL have the contract tell the agent to stop at a `TBD` and ask the person to run `specgate config set stack` or `specgate init --forja`; SHALL, on `specgate config set stack <value>` and `specgate config set testing <value>`, write the value into that header inside Specgate's block only, refusing with `config_value_invalid` a value that holds `·` or a line break; and SHALL, while either is `TBD` or the `unknown` an earlier version wrote, say so in `status` and as a warning in `doctor`, each with the command, and say nothing once both are decided.

#### Scenario: SCN-607a — Adopted with no code

- GIVEN an empty folder
- WHEN the developer runs `specgate adopt`, then `specgate status` and `specgate doctor`
- THEN `AGENTS.md` says `Stack: TBD` and `Testing: TBD` and names `specgate config set stack` and `specgate init --forja`, and both commands print `specgate config set stack "<yours>"`

#### Scenario: SCN-607b — The person decides

- GIVEN that project, with a line `Stack: do not touch this line` the team wrote below Specgate's block
- WHEN the developer runs `specgate config set stack "a · b"`, then `specgate config set stack Go` and `specgate config set testing "go test"`
- THEN the first exits 2 with `config_value_invalid`, the header says `Stack: Go` and `Testing: go test`, the team's line is as it was, and `status` and `doctor` no longer mention the stack

#### Scenario: SCN-607c — A stack read from the project

- GIVEN a folder with a `package.json`
- WHEN the developer runs `specgate adopt`
- THEN `AGENTS.md` states the stack it read, and `status` and `doctor` say nothing about deciding it

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-607.feature kind=functional status=Implemented -->

### Requirement: REQ-651 — A project forja generates is wired for Specgate's gate

The system SHALL, after `specgate init --forja <name>` ends well and `<name>` holds a forja project, adopt Specgate in it, set its test command and its architecture check from what forja generated — the package manager forja used on its `test` and `arch` scripts, or Maven's or Gradle's wrapper for a Java backend — and commit both, saying each step; what forja left as next steps is done.

#### Scenario: SCN-651a — pinta generated with pnpm

- GIVEN a forja that generates pinta with pnpm, the scripts test and arch, and its first commit
- WHEN the Developer runs `specgate init --forja pinta`
- THEN pinta has spec.md, its test command is `pnpm test` and its architecture check `pnpm run arch`, and its last commit adopts Specgate with nothing left uncommitted

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-651.feature kind=functional status=Implemented -->

### Requirement: REQ-705 — A profile for a module or a requirement, with one command

The system SHALL, on `specgate config set profiles.<name>.match.module <module>` or `profiles.<name>.match.requirement <REQ-NNN>`, write that rule under the profile in `.harness/profiles.yaml`; and SHALL refuse a module the project does not have, naming the modules it has.

> "Specgate Studio has to be configurable" (2026-11-23): the studio's Settings › Agents saves through this.

#### Scenario: SCN-705a — ausleihe given its own agent

- GIVEN a project with the modules katalog and ausleihe
- WHEN the Developer runs `specgate config set profiles.careful.agent "claude -p < {prompt_file}"` and `specgate config set profiles.careful.match.module ausleihe`
- THEN `specgate harness doctor --no-probe --json` routes ausleihe's requirements to careful; and `config set profiles.careful.match.module pagos` is refused naming katalog and ausleihe

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-705.feature kind=functional status=Implemented -->

### Requirement: REQ-706 — The sandbox, set with one command per field

The system SHALL, on `specgate config set sandbox.<field> <value>` for `engine`, `kit`, `allow` (a comma-separated list), `setup`, `image` and `network`, write that field of the `sandbox:` block of harness.config.yaml, and SHALL refuse a value with which the harness would not read the block, saying why.

#### Scenario: SCN-706a — A swarm in sbx, set from the command line

- GIVEN a project with no sandbox
- WHEN the Developer sets `sandbox.engine sbx`, `sandbox.kit opencode`, `sandbox.allow "registry.npmjs.org, opencode.ai"` and `sandbox.setup "sh scripts/sandbox-setup.sh"`
- THEN harness.config.yaml's sandbox reads engine sbx, kit opencode, the two hosts and the setup; and `config set sandbox.engine lxc` is refused

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-706.feature kind=functional status=Implemented -->

### Requirement: REQ-707 — A setting, or a whole profile, removed with one command

The system SHALL, on `specgate config unset <key>`, remove that key from its file; `config unset profiles.<name>` SHALL remove the profile and `config unset sandbox` the whole block; a key that is not set is not an error.

#### Scenario: SCN-707a — careful removed

- GIVEN the profile careful with an agent and a rule for ausleihe
- WHEN the Developer runs `specgate config unset profiles.careful`
- THEN .harness/profiles.yaml has no profile careful, and ausleihe's requirements go to the default agent

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-707.feature kind=functional status=Implemented -->
