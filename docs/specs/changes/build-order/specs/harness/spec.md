# Delta — harness

## ADDED Requirements

### Requirement: REQ-600 — Built in the brief's module order

The system SHALL, when `docs/brief.md` lists its modules, take requirements — in `status`, in `apply` with no requirement named, and in the harness's queue — module by module in the order the brief lists them, each module's requirements in the order the matrix lists them, a requirement outside every module keeping its side (before the modules when the matrix lists it before them, after them otherwise); SHALL lead the reason `status` gives for the next step with the requirement's module and its place in the brief; and SHALL, without a brief listing modules, keep the matrix's order.

#### Scenario: SCN-600a — Users before billing

- GIVEN a brief listing the modules users, then billing; billing declares REQ-002 and users REQ-022
- WHEN the person runs `specgate status`, then `specgate harness run --dry-run`
- THEN REQ-022 comes before REQ-002 in both, and status says "users, the brief's 1st module of 2"

<!-- specgate:trace actor=Developer feature=features/harness/REQ-600.feature kind=functional status=Approved -->
