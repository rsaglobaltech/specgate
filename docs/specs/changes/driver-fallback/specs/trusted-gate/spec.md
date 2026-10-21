# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-169 — A merge driver that is gone falls back to git's own merge

The system SHALL register each merge driver so that, when the specgate file it runs no longer exists, the file is merged by lines as git would merge it without the driver, with conflict markers wherever the two sides conflict, and stderr says the driver is missing and to re-run `specgate harness init`; and `specgate doctor` SHALL warn when a registered merge driver points at a file that does not exist.

#### Scenario: SCN-169a — The copy of specgate the driver ran is gone

- GIVEN a repository where `specgate harness init` registered the merge drivers, and the specgate copy they run has since been removed
- WHEN a branch that rewrote a line of a capability spec is merged into one that rewrote the same line differently
- THEN the merge stops with git's conflict markers around that line, holding both texts, and stderr says the merge driver is missing

#### Scenario: SCN-169b — Doctor names the missing driver

- GIVEN the same repository
- WHEN the developer runs `specgate doctor`
- THEN it warns that the spec merge driver points at a file that does not exist

<!-- specgate:trace status=Implemented test=tests/cli.test.ts actor=Developer kind=functional -->
