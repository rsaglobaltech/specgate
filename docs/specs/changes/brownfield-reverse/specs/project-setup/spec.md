# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-528 — reverse lists the modules of an existing system

The system SHALL, with `specgate reverse --modules [--json]`, list the candidate modules of the project — Maven or Gradle modules, npm workspaces, Go packages, and the first-level folders under `src/` or `apps/` that hold source files — each with its `path`, its detected `stack` and its `files` count, sorted by path; SHALL run no agent; and SHALL answer `no_modules` with the fix `specgate reverse <path>` when it finds none.

#### Scenario: SCN-528a — A Maven project with two modules

- GIVEN a git project whose `pom.xml` declares the modules `orders` and `billing`, each with Java sources
- WHEN a tool runs `specgate reverse --modules --json`
- THEN it exits 0 and `modules` lists `billing` then `orders`, each with `stack` `java` and its file count, and no agent was started

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-529 — reverse drafts one module into a change

The system SHALL, with `specgate reverse <module> [--agent <cmd>] [--json]`, run the configured agent with a prompt built from the module's source, tests and schema files, undo every write the agent makes outside its answer file, and write what it answers into a change `docs/specs/changes/reverse-<module>/` with reserved REQ ids; every requirement in it SHALL have the status `Draft`; `spec.md` and the capability specs SHALL not change; and the change SHALL pass `specgate change validate`, else the command SHALL answer the validation findings and keep nothing.

#### Scenario: SCN-529a — The agent drafts the orders module

- GIVEN the project of SCN-528a and an agent that answers two requirements with one scenario each for `orders`
- WHEN a tool runs `specgate reverse orders --json`
- THEN it exits 0, `docs/specs/changes/reverse-orders/` holds a delta with the two requirements, both `Draft`, and `spec.md` is unchanged

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-530 — A reversed requirement cites its evidence

The system SHALL record, in the trace comment of each requirement `reverse` writes, a `source=` list of the files and lines it was read from; `specgate validate` SHALL warn `source_missing` for a cited file that does not exist, without failing; and the system SHALL write behaviour the agent marks as suspect — a defect, not a rule — as a question in the change's `questions.md`, never as a requirement.

#### Scenario: SCN-530a — A rule, a defect and a deleted file

- GIVEN an agent that reverses `orders` into one requirement citing `src/orders/Cancel.java:12` and one behaviour it marks as suspect
- WHEN a tool runs `specgate reverse orders --json`, deletes `src/orders/Cancel.java`, then runs `specgate validate --json`
- THEN the delta has one requirement whose trace carries `source=src/orders/Cancel.java:12`, `questions.md` has one question for the suspect behaviour, and `validate` reports `source_missing` naming the deleted file

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-531 — A baseline lets an existing project adopt the gate

The system SHALL, with `specgate check --baseline`, write the gate's current findings to `docs/specs/gate-baseline.json`, each as a fingerprint of its code, file and requirement id; later `specgate check` and `specgate validate` runs SHALL fail only on findings absent from that file, SHALL report the baselined ones as `baselined` with their count, and SHALL report `baseline_fixed` for a baselined finding that no longer occurs so the file can shrink.

#### Scenario: SCN-531a — An old finding passes, a new one fails

- GIVEN a project where REQ-001 is `Implemented` with no test that names it, and `specgate check --baseline` has run
- WHEN REQ-002 is set `Implemented` with no test that names it and a tool runs `specgate check --json`
- THEN it fails with one finding for REQ-002, and reports REQ-001's finding as `baselined`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
