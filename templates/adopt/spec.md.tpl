# {{PROJECT_NAME}} — Specification

> Adopted into Spec-Driven Development on an existing codebase (brownfield).
> `specgate req add "<title>"` reserves the next `REQ-NNN` and adds its row to
> `docs/specs/traceability.md` and a draft `## REQ-NNN` section below — rewrite
> its obligation. It does not write a `.feature`: add a Gherkin scenario under
> `features/`, then `specgate req link REQ-NNN --feature … --test …` to point
> the row at both. Existing behaviour is retro-filled requirement by
> requirement — start with the ones your team is actively changing.

## Context

- Domain: {{DOMAIN}}
- Stack: {{STACK}}
- API style: {{API_STYLE}}
- Testing: {{TESTING}}

## Requirements

## REQ-001 — Existing behaviour is preserved

The adopted codebase keeps working: the full test suite passes on every
change. This requirement anchors the traceability matrix until real
requirements are retro-filled from the existing code and tests.
{{PROPOSED_REQUIREMENTS}}
