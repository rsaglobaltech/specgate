# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-177 — An open draft can reserve more ids while its range is the last

The system SHALL, when `specgate propose --from-brief <module> --reserve <n>` names a draft that is already open, grow its `req_range` to n requirement ids and its `scn_range` to three scenario ids per requirement, from the same first ids, and rewrite its DRAFTING.md with the new ranges; it SHALL refuse with `draft_range_not_last` when a requirement or scenario id after the draft's range is reserved or used elsewhere, and with `draft_range_already_holds` when n is not more than the draft holds, changing nothing.

#### Scenario: SCN-177a — The last draft grows

- GIVEN a project whose only open draft, draft-bookings, holds REQ-001…REQ-010 and SCN-001…SCN-030
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 15`
- THEN change.yaml holds REQ-001…REQ-015 and SCN-001…SCN-045, DRAFTING.md names REQ-015, and the next draft opened starts at REQ-016

#### Scenario: SCN-177b — A draft followed by another cannot grow

- GIVEN draft-bookings holds REQ-001…REQ-010 and draft-coupons was opened after it
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 15`
- THEN the command exits 1 with draft_range_not_last naming REQ-011, and change.yaml is unchanged

#### Scenario: SCN-177c — Asking for fewer than it holds

- GIVEN draft-bookings holds ten ids
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 5`
- THEN the command exits 1 saying it already holds 10, and change.yaml is unchanged

<!-- specgate:trace status=Draft test=tests/unit/draft-reserve-more.test.ts actor=Developer kind=functional -->
