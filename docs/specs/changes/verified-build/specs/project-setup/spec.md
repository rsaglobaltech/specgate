# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-651 — A project forja generates is wired for Specgate's gate

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

The system SHALL, after `specgate init --forja <name>` ends well and `<name>` holds a forja project, adopt Specgate in it, set its test command and its architecture check from what forja generated — the package manager forja used on its `test` and `arch` scripts, or Maven's or Gradle's wrapper for a Java backend — and commit both, saying each step; what forja left as next steps is done.

#### Scenario: SCN-651a — pinta generated with pnpm

- GIVEN a forja that generates pinta with pnpm, the scripts test and arch, and its first commit
- WHEN the Developer runs `specgate init --forja pinta`
- THEN pinta has spec.md, its test command is `pnpm test` and its architecture check `pnpm run arch`, and its last commit adopts Specgate with nothing left uncommitted
