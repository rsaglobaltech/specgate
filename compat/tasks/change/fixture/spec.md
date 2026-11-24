# compat-fixture — Specification

> Adopted into Spec-Driven Development on an existing codebase (brownfield).
> `specgate new "<title>"` adds the next `REQ-NNN`: a draft section below and
> a tagged scenario under `features/` — rewrite both. A test that mentions the
> id is linked to it; `specgate apply REQ-NNN` closes it once the gate passes.
> Existing behaviour is retro-filled requirement by requirement — start with
> the ones your team is actively changing.

## Context

- Domain: general
- Stack: Node.js
- API style: as built
- Testing: npm test

## Requirements

## REQ-001 — Existing behaviour is preserved

<!-- specgate:trace status=Implemented scn=SCN-001 feature=features/adoption/baseline.feature uc='UC-001 Preserve existing behaviour' -->

The adopted codebase keeps working: the full test suite passes on every
change. This requirement anchors the traceability matrix until real
requirements are retro-filled from the existing code and tests.

