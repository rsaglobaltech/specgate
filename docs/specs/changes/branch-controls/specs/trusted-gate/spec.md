# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-754 — A branch's changes to the controls are named for its reviewer

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when `specgate check` compares the project with a base, name with `controls_changed_on_branch` each control the branch changed against the merge base — the guard switched off, the gate's policy, an open change's approval, a requirement's evidence removed —, leaving out the approval of a change the branch archived; SHALL report them as warnings unless the gate's policy sets `controls: error`, which fails the gate; and SHALL say nothing of a branch that changed none.

> Measured on 2026-11-25: every control an agent went around was a file of the project. On a branch, nothing told the reviewer that one had changed.

#### Scenario: SCN-754a — The guard switched off on a branch

- GIVEN a branch of main whose `.specgate/config.json` switches the guard off
- WHEN `specgate check --base main` runs
- THEN it warns with `controls_changed_on_branch` that the guard was switched off, and the gate passes

#### Scenario: SCN-754b — The policy says error

- GIVEN the same branch, and `controls: error` in `.specgate/gate.yaml` on main
- WHEN `specgate check --base main` runs
- THEN the gate fails with `controls_changed_on_branch`

#### Scenario: SCN-754c — An archived change, and a branch that changed nothing

- GIVEN a branch of main that archived an approved change, and one that only changed the code
- WHEN `specgate check --base main` runs on each
- THEN neither is told of `controls_changed_on_branch`
