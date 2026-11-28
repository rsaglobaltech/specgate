# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-813 — Archive closes the change's evidence

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate archive <change>` in a project whose gate policy has `bdd: required` or `evidence: required`, write the change's `EVIDENCE.md` before the change moves, so the archived change holds it current; SHALL name each requirement of the change delivered with no before (`archive_no_before`), as a warning, or, under `evidence: required`, as an error that refuses the archive unless `--force` is passed; and SHALL accept `evidence: required` or `evidence: optional` in `.specgate/gate.yaml`.

#### Scenario: SCN-813a — The page goes with the change

- GIVEN draft-orders, whose REQ-031 is Implemented with a before and an after, in a project with `bdd: required`
- WHEN the Developer runs `specgate archive draft-orders`
- THEN the archived change holds EVIDENCE.md with REQ-031's section

#### Scenario: SCN-813b — No before, required

- GIVEN the same change with REQ-032 Implemented with no before, and `evidence: required`
- WHEN the Developer runs `specgate archive draft-orders`
- THEN it is refused with `archive_no_before` naming REQ-032; with `--force` it is archived

### Requirement: REQ-814 — The evidence page compares with the base the person names

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL accept `--base <ref>` on `specgate evidence <change>` and draw the page's diagrams at the base against that ref; without it, the base `check --affected` uses.

#### Scenario: SCN-814a — The base named

- GIVEN a change whose code changed since the commit `base-tag`
- WHEN the Developer runs `specgate evidence draft-orders --base base-tag`
- THEN the diagrams at the base are those of `base-tag`
