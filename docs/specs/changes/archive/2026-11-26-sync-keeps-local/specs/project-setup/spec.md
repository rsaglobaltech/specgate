# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-774 — Upgrading a pack keeps what the team wrote in spec.md

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate specops sync --pack-version <new>`, merge each file it seeds the render with — `spec.md` of a derived project and the shared catalogs — against what the pack's recorded version renders over the same copy, so that a local edit the new version does not touch is kept, a change the new version makes is applied, and an edit both made to the same line is reported as a conflict.

> Found on 2026-11-26 following the tutorial: upgrading the pack dropped the `status=Implemented` that `apply` had written, and sync reported no conflict.

#### Scenario: SCN-774a — A delivered requirement stays delivered

- GIVEN a project derived from a pack at v0.1.0, with REQ-001 marked `status=Implemented` in `spec.md`
- WHEN the team runs `specgate specops sync --pack-version v0.2.0`, and v0.2.0 adds REQ-006 and leaves REQ-001 as it was
- THEN `spec.md` still marks REQ-001 `status=Implemented`, and holds REQ-006
