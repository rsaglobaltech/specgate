# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-800 — With `link: strict`, a comment does not link a test

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when `.specgate/gate.yaml` says `link: strict`, link a test file to a requirement or a scenario only when it names its id outside a comment — in a test's name, a tag, a string or the code — where a comment is `//`, `/* … */` or `#` to the end of the line, as the file's language writes it, and never inside a string; SHALL leave a `test=` in the trace and the code column as they are; and SHALL, without `link:` or with `link: mention`, link as before.

> Reported on 2026-11-27: a test file whose comment said "REQ-007" was REQ-007's test, and `apply` judged only that the suite passed.

#### Scenario: SCN-800a — A comment is not a link

- GIVEN `link: strict`, and `tests/login.test.js` whose only mention of REQ-007 is `// REQ-007: covered elsewhere`
- WHEN the matrix is derived
- THEN REQ-007 has no test, and `specgate apply REQ-007` is refused with `apply_no_test`, its fix saying a comment does not count under `link: strict`

#### Scenario: SCN-800b — A test's name is a link

- GIVEN `link: strict`, and `tests/login.test.js` with `test("REQ-007: a locked account is refused", …)`, and `const url = "http://x/REQ-008"` under a `// REQ-009` comment
- WHEN the matrix is derived
- THEN REQ-007 and REQ-008 are linked to `tests/login.test.js`, and REQ-009 is not

### Requirement: REQ-801 — The gate policy reads `link`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL accept `link: mention` and `link: strict` in `.specgate/gate.yaml`, report any other value as a problem of the policy with the two values to use, and write in the file `specgate init` creates a commented `link: strict` line that says what it does.

#### Scenario: SCN-801a — A value the policy does not know

- GIVEN `.specgate/gate.yaml` with `link: tags`
- WHEN the policy is read
- THEN it has the problem "link `tags` is not mention or strict", and the fix names `link: strict`
