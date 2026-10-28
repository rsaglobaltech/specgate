# Delta — studio

## ADDED Requirements

### Requirement: REQ-233 — The studio saves the specification in git before a build

The system SHALL, when a build is started from the studio, commit what the studio and the drafting wrote — docs/brief.md, spec.md, docs/specs/, features/, harness.config.yaml and .harness/profiles.yaml and prompt-prefix.md — with the person's own git identity and a message that says it came from the studio, so the harness finds the clean tree it needs; and SHALL refuse the build, naming the files, when anything else is uncommitted, or when git has no identity, saying how to set it.

#### Scenario: SCN-233a — The brief edited in the studio is committed

- GIVEN docs/brief.md and a change's change.yaml modified and not committed, and a requirement ready to build
- WHEN a build is started from the studio
- THEN both files are in a new commit whose message says it came from the studio, the tree is clean, and the build starts

#### Scenario: SCN-233b — Code left uncommitted stops the build

- GIVEN src/app.ts modified and not committed
- WHEN a build is started from the studio
- THEN it is refused naming src/app.ts, and nothing is committed

<!-- specgate:trace status=Implemented test=tests/unit/studio-commit.test.ts actor=Developer kind=functional -->
