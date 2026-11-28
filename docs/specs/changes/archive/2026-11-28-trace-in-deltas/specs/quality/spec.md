# Delta — quality

## ADDED Requirements

### Requirement: REQ-825 — A delta's trace value cut at a space is reported

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, on `specgate change validate`, warn `trace_value_cut` for each unquoted trace value of a change's delta followed by a word with no `=`, naming the file, the line, what is read and the quoted form to write — as `validate` does for the specs — so archive never writes the short value into the spec.

#### Scenario: SCN-825a — An actor cut in a delta

- GIVEN a change whose delta's trace says `actor=Product owner`
- WHEN the Developer runs `specgate change validate triage`
- THEN it warns that `actor=Product owner` is read as `actor=Product`, with `actor="Product owner"` to write, and says nothing once it is quoted
