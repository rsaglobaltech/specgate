# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-745 — A requirement of a change nobody approved is not delivered

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-745.feature actor=Developer kind=functional -->

The system SHALL refuse `specgate apply` for a requirement of an open change that is not approved, where the project's approvals are required, with `change_not_approved`, naming the change and the approval it waits for, whose fix is `specgate change approve`, by a person; and SHALL deliver as before a requirement of an approved change, a requirement no change owns, and any requirement where `approvals.required` is `never`.

> Measured on 2026-11-25: asked for something no requirement asks for, an agent opened a change, wrote REQ-005 itself and delivered it with `specgate apply`. Nobody approved it.

#### Scenario: SCN-745a — Its own requirement

- GIVEN export-loans open with REQ-005, written in the session and approved by nobody
- WHEN `specgate apply REQ-005` runs with the gate green
- THEN apply fails with `change_not_approved` naming export-loans, and REQ-005 stays as it was

#### Scenario: SCN-745b — An approved change is delivered

- GIVEN the same change, approved
- WHEN `specgate apply REQ-005` runs
- THEN REQ-005 is delivered

#### Scenario: SCN-745c — A project that asks for no approvals

- GIVEN the change of SCN-745a and `approvals: { required: never }`
- WHEN `specgate apply REQ-005` runs
- THEN REQ-005 is delivered

#### Scenario: SCN-745d — No change owns it

- GIVEN REQ-001 written straight into spec.md
- WHEN `specgate apply REQ-001` runs
- THEN apply says nothing of approvals

### Requirement: REQ-746 — A person's acts are refused to the agent's session

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-746.feature actor=Developer kind=functional -->

The system SHALL, where Specgate's hooks run in the agent's tool, refuse a tool call of the agent's that approves a change, switches the guard, says a person reviewed the steps, or writes, moves or removes the files the controls keep — the guard's switch, the gate's policy, the evidence, a change's approvals — saying the act is a person's; SHALL allow a call that reads them; SHALL NOT say, in any refusal of the guard, how to switch the guard off; and SHALL, in OpenCode, keep the guard as it was when the session started.

> Measured on 2026-11-25: refused, an agent ran `specgate config set agent_guard off` — the refusal had told it to — in two runs of twelve, removed `.specgate/evidence` in three, and ran `specgate apply --steps-reviewed` inside a terminal it made for itself in one.

#### Scenario: SCN-746a — Switching the guard off

- GIVEN a session of the agent's in a project with the guard on
- WHEN the agent's shell runs `specgate config set agent_guard off`
- THEN the call is refused, saying that switching the guard is a person's

#### Scenario: SCN-746b — Approving its own change

- GIVEN the same session
- WHEN the agent's shell runs `specgate change approve draft-fees`
- THEN the call is refused, saying that approving is a person's

#### Scenario: SCN-746c — A review nobody made

- GIVEN the same session
- WHEN the agent's shell runs `specgate apply REQ-002 --steps-reviewed`
- THEN the call is refused, saying that reviewing the steps is a person's

#### Scenario: SCN-746d — The record removed

- GIVEN the same session
- WHEN the agent's shell runs `rm -rf .specgate/evidence`, or its file tool writes `.specgate/config.json`
- THEN the call is refused, naming the file

#### Scenario: SCN-746e — Reading is allowed

- GIVEN the same session
- WHEN the agent's shell runs `cat .specgate/evidence/REQ-002/steps.json`
- THEN the call is allowed

#### Scenario: SCN-746f — No way out in the refusal

- GIVEN source written before its test
- WHEN the guard refuses
- THEN the refusal does not name `agent_guard`

#### Scenario: SCN-746g — The switch, after the session started

- GIVEN an OpenCode session started with the guard on
- WHEN `.specgate/config.json` comes to say `agent_guard: off`, and the agent writes source before its test
- THEN the write is refused

### Requirement: REQ-747 — A run that changed the controls fails, judged from outside it

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-747.feature actor=Developer kind=functional -->

The system SHALL, in `specgate harness run` and in `specgate compat run`, read the controls before the agent starts — the guard's switch, the gate's policy, each open change's approvals, the evidence, the steps said to be reviewed — keep that reading where the agent does not write, and fail the attempt or the run with `controls_changed_by_session` when the agent stops, naming each one that changed; SHALL read the steps against the record the guard wrote to the hook log, where there is one, so a record removed from the project is still seen; and SHALL say nothing of a run that changed none.

> Measured on 2026-11-25: every control a run went around was a file in the folder the run was writing.

#### Scenario: SCN-747a — The guard switched off

- GIVEN a run whose project has the guard on when the agent starts
- WHEN the agent stops with `agent_guard: off` in the project
- THEN the run fails with `controls_changed_by_session`, naming the guard

#### Scenario: SCN-747b — Approved by the session

- GIVEN a run whose change export-loans has no approval when the agent starts
- WHEN the agent stops with export-loans approved
- THEN the run fails with `controls_changed_by_session`, naming the approval of export-loans

#### Scenario: SCN-747c — The record removed

- GIVEN a run whose guard wrote REQ-002's steps to the hook log
- WHEN the agent stops with no record in the project and features/fees/REQ-002.steps.js changed since
- THEN the run fails with `controls_changed_by_session`, naming the steps of REQ-002

#### Scenario: SCN-747d — A run that kept to them

- GIVEN a run that wrote its test, its code and its evidence
- WHEN the agent stops
- THEN the judge says nothing of the controls
