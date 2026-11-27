# Delta — brief-drafting

## ADDED Requirements

### Requirement: REQ-799 — A requirement's brief quote is in the brief

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL report, on `specgate draft --check` and while a module is drafted, `D17_quote_not_in_brief` for each `> Brief: "…"` line of a requirement whose text is not in the brief — compared without case, quote marks, emphasis, runs of space or the closing punctuation — at the quote's line, its fix to quote the brief's own sentence or drop the requirement; and SHALL skip the rule when no brief is given.

> Reported on 2026-11-27: REQ-011 quoted «Recuperación de acceso.» and stated the opposite of the brief; the checklist passed, and no code read the quote back.

#### Scenario: SCN-799a — A quote the brief never wrote

- GIVEN a brief that says "A member recovers access with their email." and REQ-011 quoting `> Brief: "Access is never recovered."`
- WHEN the draft is checked
- THEN `D17_quote_not_in_brief` names REQ-011 at the quote's line

#### Scenario: SCN-799b — The brief's sentence, wrapped and quoted

- GIVEN the same brief, its sentence wrapped over two lines, and REQ-011 quoting `> Brief: "A member *recovers* access with their email"`
- WHEN the draft is checked
- THEN no `D17_quote_not_in_brief` is reported
