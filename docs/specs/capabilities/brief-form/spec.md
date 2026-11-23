# Brief Form

## Requirements

### Requirement: REQ-669 — Why and Quality in the brief's form

The system SHALL carry, in `specgate propose --from-brief --form --json`, the brief's `## Why` as `why` — its text and its heading's line, null when the brief has none — and its `## Quality` as `quality`, one entry per line, each its ISO/IEC 25010 characteristic (null when it names none), the modules it names, its text and its line; and SHALL, when a form written back gives `why` or `quality` changed, rewrite only that section — making it, before the modules, when the brief had none — every other byte kept; a form that gives neither leaves both as they are.

> #524: "a form-based editor cannot show or edit Why and Quality, and it cannot put a B14 or B15 finding on the field it is about."

#### Scenario: SCN-669a — Read with both sections

- GIVEN a brief with `## Why` and a `## Quality` line "Performance (courses): a page answers in under 2 s"
- WHEN the Developer runs `specgate propose --from-brief --form --json`
- THEN `why` holds its text and line, and `quality` holds one entry, its characteristic `performance efficiency`, its modules `courses`, its text and line

#### Scenario: SCN-669b — Quality written back, the rest kept

- GIVEN the same brief
- WHEN a form is written back with a second quality line and nothing else changed
- THEN only `## Quality` is rewritten, with both lines, and every other byte of the brief is as it was

<!-- specgate:trace actor=Developer feature=features/brief-form/REQ-669.feature kind=functional status=Implemented -->
