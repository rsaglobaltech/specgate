# Delta — studio

## ADDED Requirements

### Requirement: REQ-474 — The studio opens a folder that is not a project yet

The system SHALL start `specgate studio` in a folder that is not a specgate project and show a start screen that says what the folder holds — empty, or code — and, for code, offers to adopt it in place: first a preview of the files adoption would write, then adoption, after which the studio shows the adopted project; for an empty folder it shows the command that creates one.

#### Scenario: SCN-474a — An existing project adopted from the studio

- GIVEN a local Node project with no specgate files
- WHEN the developer runs `specgate studio` there, previews the adoption and confirms it
- THEN the studio shows the files the preview listed, then the adopted project's Home with its one requirement, and the folder has spec.md and `test_cmd: npm test`

<!-- specgate:trace status=Approved actor=Developer kind=functional -->
