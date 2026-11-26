# Delta — daily-surface

## MODIFIED Requirements

### Requirement: REQ-115 — The old names keep working

The system SHALL keep `draft`, `change new`, `change archive` and `done`
working for scripts with the behaviour of the verb that replaces them, and
SHALL name that verb in the first line of each old name's `--help`.

#### Scenario: SCN-115a — A script written for 0.20

- GIVEN a CI script that runs `specgate change new add-dynamic-pricing` and later, the change approved, `specgate done REQ-002`
- WHEN it runs against this version
- THEN both commands succeed as `propose` and `apply` would
- AND `specgate change archive --help` starts with "Same as specgate archive"

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-115.feature test=tests/unit/compact-use.test.ts actor=Developer kind=functional -->

### Requirement: REQ-116 — One loop: four verbs and an approval

The system SHALL let a developer take a requirement from nothing to archived
and Implemented using only `init`, `propose`, `apply`, `archive` and `status`,
and the approval of the change, `change approve`, before `apply`, editing only
the change's delta, a test and the code.

#### Scenario: SCN-116a — The loop end to end

- GIVEN a Node.js repository with code, a `package.json` and a passing `npm test`
- WHEN the developer runs `specgate init`, `specgate propose add-greeting`, writes one requirement in the change's delta, a test naming it and the code, then runs `specgate status`, `specgate change approve add-greeting`, `specgate apply` and `specgate archive add-greeting`
- THEN every command exits 0, the requirement is Implemented in its capability spec, and `specgate status` no longer lists it as pending
- AND no other specgate command was run

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-116.feature test=tests/unit/compact-use.test.ts actor=Developer kind=functional -->
