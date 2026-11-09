# Delta — studio

## ADDED Requirements

### Requirement: REQ-275 — The studio's Build follows the gate's steps

The system SHALL place the running requirement of the studio's Build in Programa until its gate starts, in Prueba while the specification, architecture and test steps run, in Revisa la calidad while a quality check runs, and in Guarda once it merges; and SHALL name the step that is running, with how long it has run.

#### Scenario: SCN-275a — Building while a quality check runs

- GIVEN the studio page
- WHEN it is served
- THEN its Build reads `gate-start` events, puts a `quality:` step in the third stage, and shows the running step's name

<!-- specgate:trace status=Implemented test=tests/unit/live-gate-steps.test.ts actor=Developer kind=functional -->
