# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-793 — The guard refuses a new file the approved design does not name

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL refuse, in the agent guards, a write that creates a source file when an open change's approved design names source files and not that one, unless the gate's rule `scope` is off — with `file_outside_design`, the files the design names, and that the work waits for a person: a change of its own, or the design named and approved again; and SHALL leave alone a file that already exists and one the design names.

> Measured on 2026-11-26: a Codex run linked its unrequested `src/export.js` to an unrelated requirement's test, so the guard let it write the file; the gate refused it only at the end.

#### Scenario: SCN-793a — A file nobody designed

- GIVEN draft-fees approved, its design naming `src/fees.js`, and a test naming REQ-031
- WHEN an agent's tool asks to write the new `src/export.js`
- THEN it is refused with `file_outside_design`, naming `src/export.js` and `specgate propose`; writing `src/fees.js` is allowed

### Requirement: REQ-794 — Sealing acceptance tests runs them once for the person

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, once `specgate change approve <id> --layer acceptance` has sealed the tests and when `acceptance_cmd` is set, run the sealed tests once and show the person whether they pass and, when they fail, the lines that say why — so a test that can never pass, such as one that loads a file by a wrong path, is seen before an agent is given it.

> Measured on 2026-11-26: in two Codex runs the writer sealed step definitions that load the module by a path outside the project; no agent could make them pass.

#### Scenario: SCN-794a — A wrong path

- GIVEN `acceptance_cmd` set, and an acceptance test that loads `../../../src/fees.js` from two folders deep
- WHEN a person runs `specgate change approve draft-fees --layer acceptance`
- THEN the tests are sealed, the output says they ran once, and shows `Cannot find module '../../../src/fees.js'`
