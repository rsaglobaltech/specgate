# Delta — trusted-gate

## MODIFIED Requirements

### Requirement: REQ-120 — An id taken on the base branch is refused before merge

The system SHALL, in `specgate check`, compare every requirement the branch declares — in capability specs and in open changes — with the requirements on the base branch, and SHALL fail with `id_taken_on_base` when an id this branch introduced — one absent where the branch and the base last met — exists on the base with a different title, naming both titles and the next free id; the base branch SHALL be `--base`, else `SPECGATE_BASE`, else the `pr: base:` of `alm.config.yaml` when that branch exists, else the remote's default branch; it SHALL skip the comparison, saying so, when there is no git repository or no base reference.

#### Scenario: SCN-120a — Two branches, one id

- GIVEN a base branch `develop` whose capability spec declares REQ-003 "Export orders as CSV", and a branch whose open change adds REQ-003 "Refund an order"
- WHEN the developer runs `specgate check --base develop` on the branch
- THEN the gate fails with `id_taken_on_base`, the message names both titles, and the fix names the next id free on both sides
- AND the same requirement with the same title on both sides is not a collision

#### Scenario: SCN-120b — No base to compare with

- GIVEN a project with no git repository
- WHEN the developer runs `specgate check`
- THEN the gate does not fail for ids, and says the base comparison was skipped

#### Scenario: SCN-120c — A gitflow project compares with develop

- GIVEN a clone whose remote's default branch is `main`, an `alm.config.yaml` with `pr: base: develop`, and a `develop` branch that declares REQ-003 "Export orders as CSV"
- WHEN the developer runs `specgate check` with no `--base` on a branch whose open change adds REQ-003 "Refund an order"
- THEN the gate fails with `id_taken_on_base` and says the ids were compared with `develop`

#### Scenario: SCN-120d — A requirement the base changed is not an id taken

- GIVEN a branch started from `develop` when REQ-009 was "An owner's telephone is exactly 10 digits", and `develop` has since renamed REQ-009 "An owner's telephone is 10 digits, or an international number"
- WHEN the developer runs `specgate check` on the branch, which has not touched REQ-009
- THEN the gate does not fail with `id_taken_on_base` for REQ-009

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-120.feature test=tests/unit/trust-gate.test.ts actor=Developer kind=business-rule -->
