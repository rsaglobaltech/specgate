# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-748 — Approving takes a person at a terminal

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL refuse `specgate change approve` when its input is not a terminal and `SPECGATE_ASSUME_TTY` is not set, with `approve_needs_person`, saying approving is a person's act and recording nothing; and SHALL approve as before at a terminal and through the studio's Review.

> Measured on 2026-11-25: Codex, which runs Specgate with no hooks, ran `specgate change approve export-csv --layer design` on the change it had just written, and the command approved it.

#### Scenario: SCN-748a — An agent's command

- GIVEN export-csv open and not approved
- WHEN `specgate change approve export-csv` runs with no terminal
- THEN it fails with `approve_needs_person`, and export-csv has no approval

#### Scenario: SCN-748b — A person at a terminal

- GIVEN the same change
- WHEN a person runs `specgate change approve export-csv` at a terminal
- THEN export-csv is approved
