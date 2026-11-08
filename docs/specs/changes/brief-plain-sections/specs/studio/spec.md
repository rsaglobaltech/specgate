# Delta — brief-plain-sections

## ADDED Requirements

### Requirement: REQ-437 — A module written under a plain heading stays one section

The system SHALL, when the studio saves the brief form, write a module whose brief has no `## Module: <name>` section but a plain `## <name>` heading for a module the front matter lists as that module's `## Module: <name>` section in the heading's place, keeping the heading's prose inside it, so the brief holds one section for the module; and SHALL leave a plain heading that names no listed module as it is.

#### Scenario: SCN-437a — A hand-written module section is kept as the module's

- GIVEN `docs/brief.md` listing `modules: [orders]`, with a `## Context` section and a `## orders` section whose prose says "Shipping is free above some amount."
- WHEN the form is saved with the rule "An order has at least one item" for orders
- THEN the brief has one `## Module: orders` section holding that prose and the rule, no `## orders` heading, and the `## Context` section unchanged

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
