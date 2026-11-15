# Delta — domain-language

## MODIFIED Requirements

### Requirement: REQ-539 — Business rules are numbered and each one is tested

The system SHALL read a `Rules:` list in a requirement's body whose items start with `BR-NNN`, rule ids unique across the specification; `specgate validate` SHALL report `rule_duplicate` for a rule id used twice — by two requirements, or twice in one file — and SHALL NOT report it for an open change's delta that restates the same requirement with its rules; and `specgate validate --strict` SHALL report `rule_untested` for each rule of a delivered requirement that no test mentions. The traceability matrix keeps its columns: a rule is linked to its test by the test naming it.

#### Scenario: SCN-539a — One rule tested, one not

- GIVEN REQ-001 `Implemented` with the rules BR-001 and BR-002, and a test that mentions REQ-001 and BR-001
- WHEN a tool runs `specgate validate --strict --json`
- THEN it fails with `rule_untested` for BR-002 only

#### Scenario: SCN-539b — A change restates a requirement with rules

- GIVEN REQ-014 in a capability spec with the rules BR-021 and BR-022, and an open change whose MODIFIED delta restates REQ-014 with both rules
- WHEN a tool runs `specgate validate --json`
- THEN it reports no `rule_duplicate`; with a second requirement that also uses BR-021, it reports `rule_duplicate` for BR-021

<!-- specgate:trace status=Implemented feature=features/domain-language/REQ-539.feature actor=Developer kind=functional -->

### Requirement: REQ-541 — The actors diagram is generated

The system SHALL generate `docs/specs/actors.md` — a Mermaid `flowchart` linking each actor to the capabilities and requirements that name it — from the actors in `docs/brief.md`'s front matter and the `actor=` of each requirement's trace; `check` SHALL regenerate it when the brief names an actor; an actor SHALL match the brief's ignoring case, and be drawn as the brief spells it; and `specgate validate` SHALL report `actors_stale` when the committed file differs, and warn `actor_unknown` for a requirement whose actor the brief does not list.

#### Scenario: SCN-541a — Two actors, one unknown

- GIVEN a brief with the actors `Customer` and `Clerk`, REQ-001 with `actor=Customer` and REQ-002 with `actor=Admin`
- WHEN a tool runs `specgate check` then `specgate validate --json`
- THEN `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports `actor_unknown` for REQ-002 naming `Admin`

#### Scenario: SCN-541b — An actor written in another case

- GIVEN a brief with the actor `Customer`, and REQ-001 with `actor=customer`
- WHEN a tool runs `specgate check` then `specgate validate --json`
- THEN `docs/specs/actors.md` links `Customer` to REQ-001, and `validate` reports no `actor_unknown`

<!-- specgate:trace status=Implemented feature=features/domain-language/REQ-541.feature actor=Developer kind=functional -->
