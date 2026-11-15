# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-416 — A rule citing a law names its source

The system SHALL tell whoever writes a layered change's specs that a `kind=business-rule` requirement citing a law, regulation, standard or contract carries a `Source:` line, with an example; and `change approve`, refusing a change with `approve_blocked`, SHALL give as its fix each blocker's own fix, prefixed with the requirement or item it is about.

#### Scenario: SCN-416a — A driving-time rule cites the regulation

- GIVEN contracts' change track-fleet has REQ-004, a business rule citing "the EU regulation on driving times" with no `Source:`
- WHEN the developer runs `specgate change instructions specs track-fleet --json` and `specgate change approve track-fleet --json`
- THEN the instructions show `Source: Regulation (EC) No 561/2006`, and approve is refused naming that REQ-004 names no source, with the fix `REQ-004: Add a "Source:" line`

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/change-lifecycle/REQ-416.feature test=tests/unit/rc10-contract.test.ts -->
