# Delta — studio

## ADDED Requirements

### Requirement: REQ-551 — A change reviewed by people who do not read the repository

The system SHALL, with `specgate review <change> [--out <file>]`, write one self-contained HTML file — no external script, stylesheet or font — with the change's intent, each requirement's title, text, status and scenarios as plain steps, its open questions and its assumptions, and the date and commit it was made from; and SHALL refuse a change id that does not exist with `change_not_found`.

#### Scenario: SCN-551a — A page that opens without a network

- GIVEN an open change `pdf-invoices` with REQ-007, one scenario and one open question
- WHEN a tool runs `specgate review pdf-invoices --out review.html`
- THEN `review.html` holds REQ-007's title, its scenario's steps and the question, and has no `src` or `href` attribute pointing outside the file

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-552 — A journey chains requirements and owes a test

The system SHALL read a scenario tagged `@JRN-NNN` together with the `@REQ-NNN` tags of the requirements it crosses as a journey; the traceability matrix SHALL list each journey with its requirements and the test that mentions its id; and `specgate validate --strict` SHALL report `journey_untested` for a journey whose requirements are all delivered and that no test mentions, and `journey_requirement_unknown` for a tag naming a requirement that does not exist.

#### Scenario: SCN-552a — Borrow then return

- GIVEN REQ-002 and REQ-003 `Implemented`, and a scenario tagged `@JRN-001 @REQ-002 @REQ-003` that no test mentions
- WHEN a tool runs `specgate validate --strict --json`
- THEN it fails with `journey_untested` for JRN-001, and the matrix lists JRN-001 with REQ-002 and REQ-003

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-553 — The studio serves a team, by role

The system SHALL, with `specgate studio --team`, require sign-in through the Git provider named in `studio.team.yaml` and give each signed-in user the role the file assigns — `reader`, `editor` or `admin`, `reader` by default; a `reader` SHALL see every section and SHALL be refused every write with `role_forbidden`; and without `--team` the studio SHALL keep today's local behaviour with no sign-in.

#### Scenario: SCN-553a — A reader tries to answer a question

- GIVEN `studio --team` running with `studio.team.yaml` giving `ana` the role `reader`
- WHEN `ana` signs in and answers an open question through the studio's API
- THEN the answer is refused with `role_forbidden` and `questions.md` is unchanged

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-554 — In team mode, edits arrive as pull requests

The system SHALL, in team mode, write an editor's change to the specification on a branch `studio/<user>/<change>` with a commit authored by that user, and open or update a pull request to the configured base branch, never committing to the base branch itself; and SHALL answer the pull request's URL.

#### Scenario: SCN-554a — An editor answers a question

- GIVEN `studio --team` with `luis` as `editor` and an open question in the change `pdf-invoices`
- WHEN `luis` answers it through the studio
- THEN a commit authored by `luis` exists on `studio/luis/pdf-invoices`, a pull request to the base branch is open with it, the base branch has no new commit, and the answer holds the pull request's URL

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
