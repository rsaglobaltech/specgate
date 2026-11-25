# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-742 — Source written by any means before its test stops the session

<!-- specgate:trace status=Draft feature=features/trusted-gate/REQ-742.feature actor=Developer kind=functional -->

The system SHALL, where Specgate's hooks run in the agent's tool, refuse the agent's next tool call — its shell included — while the working tree holds a new or changed source file and no new or changed test names a requirement of the open change, naming the file and the requirement whose test is owed; and SHALL allow a call that reads, and a call that writes a test.

> Measured on 2026-11-24: refused a write to src/fees.js, an agent wrote it with `cat > src/fees.js` in its shell, five times of six.

#### Scenario: SCN-742a — Written through the shell

- GIVEN draft-fees open with REQ-002 and no test changed, and src/fees.js written by a shell command
- WHEN the agent calls its shell again
- THEN the call is refused, naming src/fees.js and REQ-002

#### Scenario: SCN-742b — The test puts it right

- GIVEN the same session, refused
- WHEN the agent writes test/fees.test.js naming REQ-002, then calls its shell
- THEN the write is allowed, and the shell call after it

#### Scenario: SCN-742c — Reading is not stopped

- GIVEN the same session, refused
- WHEN the agent reads spec.md
- THEN the call is allowed

### Requirement: REQ-743 — Step definitions changed after the code began fail the gate

<!-- specgate:trace status=Draft feature=features/trusted-gate/REQ-743.feature actor=Developer kind=functional -->

The system SHALL record the step definitions of a requirement's scenarios as they are when the first source file of its delivery is written, and SHALL fail `specgate apply` and the harness gate with `steps_changed_after_code` when a step definition was added or changed after that, naming the file, whose fix is for a person to review it and run `specgate apply <REQ> --steps-reviewed`; and SHALL say, where nothing recorded them, that the steps were written in the same delivery as the code.

> Measured on 2026-11-24: its code built to a test that said otherwise, an agent wrote the step "the fee is {float}" as `assert.equal(fee, expected * 2)`, and the gate's scenarios passed, three times of three.

#### Scenario: SCN-743a — Steps bent to the code

- GIVEN REQ-002's steps recorded when src/fees.js was first written
- WHEN features/step_definitions/fees.steps.js is changed, and the Developer runs `specgate apply REQ-002`
- THEN apply fails with `steps_changed_after_code` naming features/step_definitions/fees.steps.js

#### Scenario: SCN-743b — Steps first

- GIVEN REQ-002's step definitions written before any source file, and not changed since
- WHEN the Developer runs `specgate apply REQ-002`
- THEN the gate says nothing of the steps

#### Scenario: SCN-743c — A person looked

- GIVEN the finding of SCN-743a
- WHEN the Developer runs `specgate apply REQ-002 --steps-reviewed`
- THEN REQ-002 is delivered, and its evidence says the steps were reviewed and by whom

#### Scenario: SCN-743d — Nothing recorded them

- GIVEN REQ-002 delivered with no hook and no harness, its step definitions new in the working tree
- WHEN the Developer runs `specgate apply REQ-002`
- THEN apply passes, saying the steps were written in the same delivery as the code and were not reviewed

### Requirement: REQ-744 — A delivery says the source files its change's design does not name

<!-- specgate:trace status=Draft feature=features/trusted-gate/REQ-744.feature actor=Developer kind=functional -->

The system SHALL, when the design of an approved change names source files, report `file_outside_design` for each new source file of a delivery that the design does not name, as a warning, and as an error where the gate's rule `scope` is `error`, whose fix is to name the file in the design and have it approved again, or to open a change for it; and SHALL say nothing where the design names no source file.

> Measured on 2026-11-24: asked for a function no requirement asked for, an agent wrote src/export.js and a test that named REQ-002, the late fee, and the gate passed, three times of three.

#### Scenario: SCN-744a — A file nobody designed

- GIVEN draft-fees approved, its design naming src/fees.js, and the rule `scope: error`
- WHEN a delivery adds src/export.js and the Developer runs `specgate check`
- THEN the gate fails with `file_outside_design` naming src/export.js

#### Scenario: SCN-744b — A warning by default

- GIVEN the same project with no `scope` rule
- WHEN the Developer runs `specgate check`
- THEN the gate passes with the warning `file_outside_design` naming src/export.js

#### Scenario: SCN-744c — A design that names no file

- GIVEN draft-fees of lite rigor, its design not written
- WHEN a delivery adds src/export.js and the Developer runs `specgate check`
- THEN the gate says nothing of it
