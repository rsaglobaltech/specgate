# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-193 — Status names the module of the next use case

The system SHALL, in a forja project, propose for the next requirement `specgate add usecase <module>/<Name>` with the module taken from the open change that holds it (`draft-diario` → `diario`) or from its feature's folder (`features/diario/…`), and SHALL print `<module>` only when neither says.

#### Scenario: SCN-193a — The module from the change or the feature's folder

- GIVEN REQ-022 is in change draft-diario, or its feature is features/diario/registrar-clase.feature
- WHEN status proposes the next command
- THEN it is `specgate add usecase diario/<Name> --req REQ-022`, or `specgate add usecase diario/RegistrarClase --req REQ-022`

<!-- specgate:trace status=Implemented test=tests/unit/forja-front-door.test.ts actor=Developer kind=functional -->

### Requirement: REQ-194 — DRAFTING.md gives the draft's real limit

The system SHALL say in DRAFTING.md how many requirement ids the draft holds — its range, never more than the review limit — and how to grow the range, instead of a review limit larger than the range.

#### Scenario: SCN-194a — The range is the limit

- GIVEN a draft reserving REQ-002 to REQ-011 with a review limit of 25
- WHEN DRAFTING.md is written
- THEN it says "`REQ-002` … `REQ-011`: 10 ids, no others" and names `specgate draft --reserve <n>`, and not "at most 25 requirements"

<!-- specgate:trace status=Implemented test=tests/unit/forja-front-door.test.ts actor=Developer kind=functional -->

### Requirement: REQ-195 — No inline code split across lines in the changelog

The system's CHANGELOG.md SHALL open and close every inline code span on one line, checked by a test.

#### Scenario: SCN-195a — Every code span on one line

- GIVEN CHANGELOG.md
- WHEN its lines outside code fences are read
- THEN none has an odd number of backticks

<!-- specgate:trace status=Implemented test=tests/unit/changelog-format.test.ts actor=Developer kind=non-functional -->

### Requirement: REQ-197 — Opening a module says which drafts stop growing

The system SHALL, when `specgate draft <module>` opens a draft while another open draft holds no requirement yet, add a note naming it, saying it can no longer grow its range, and how to avoid it.

#### Scenario: SCN-197a — Opening the second module warns about the first

- GIVEN draft-bookings is open and unwritten
- WHEN `specgate draft coupons` opens a draft
- THEN its status has draft_other_unwritten naming draft-bookings, with `--reserve` in its fix

<!-- specgate:trace status=Implemented test=tests/unit/draft-from-brief.test.ts actor=Developer kind=functional -->
