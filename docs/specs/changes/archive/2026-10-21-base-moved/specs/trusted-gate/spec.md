# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-168 — A change never replaces a requirement that moved under it

The system SHALL record in an open change's `change.yaml`, as `based_on`, a fingerprint of each requirement the change modifies or removes, taken from the capability spec when `specgate check` or `specgate change validate` first sees it, and ignoring its trace comment; SHALL warn with `change_base_moved` on `check`, and refuse to archive with `change_base_moved`, when that requirement in the capability spec no longer matches its fingerprint; SHALL warn with `change_base_moved` on `check` when the requirement differs between the base branch and the commit where this branch and the base last met; and SHALL record the requirement's current text again on `specgate change validate <change> --rebased`.

#### Scenario: SCN-168a — The other ticket merged first

- GIVEN an open change that modifies REQ-009, checked once while REQ-009 read "An owner's telephone is exactly 10 digits", and a capability spec where REQ-009 now reads "An owner's telephone is 10 digits, or an international number"
- WHEN the developer runs `specgate archive` for that change
- THEN it refuses with `change_base_moved` naming REQ-009, and the capability spec is unchanged

#### Scenario: SCN-168b — The base moved before the branch caught up

- GIVEN a branch whose open change modifies REQ-009, and a base branch `develop` where REQ-009 has been rewritten since the branch started
- WHEN the developer runs `specgate check --base develop`
- THEN it warns `change_base_moved` for REQ-009, naming `develop`

#### Scenario: SCN-168c — The delta was rewritten over the new text

- GIVEN the change of SCN-168a, with its delta rewritten over the new REQ-009
- WHEN the developer runs `specgate change validate` for it with `--rebased`, then `specgate check`
- THEN `check` reports no `change_base_moved`

<!-- specgate:trace status=Implemented test=tests/unit/change-base.test.ts actor=Developer kind=functional -->
