# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-166 — Capability specs merge requirement by requirement

The system SHALL, once `specgate harness init` has registered it, merge `docs/specs/capabilities/*/spec.md` requirement by requirement: a requirement only one side added, changed or removed takes that side; one both sides changed alike takes that text; the result lists the requirements in id order; and only a requirement both sides changed differently is left in conflict, with markers around that requirement alone. `specgate doctor` SHALL report a clone where `.gitattributes` names the driver and its git config does not.

#### Scenario: SCN-166a — Two branches add to a capability that did not exist

- GIVEN a repository with the merge drivers registered, a branch that archived REQ-009 into a new `owners` capability, and another that archived REQ-006 and REQ-007 into it
- WHEN the second branch is merged into the first
- THEN the merge succeeds without a conflict and `owners/spec.md` lists REQ-006, REQ-007 and REQ-009, in that order

#### Scenario: SCN-166b — Both sides rewrote the same requirement

- GIVEN the same requirement REQ-009 rewritten differently on each side
- WHEN the branches are merged
- THEN the merge stops with a conflict around REQ-009 only, and every other requirement is merged

<!-- specgate:trace status=Implemented test=packages/core/test/unit/capability-spec-merge.test.ts actor=Developer kind=functional -->
