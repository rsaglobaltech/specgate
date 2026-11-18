# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-601 — Quality requirements under ISO/IEC 25010

The system SHALL read a brief's `## Quality` section (also `## Calidad`, `## Quality requirements`, `## Requisitos de calidad`, `## Non-functional requirements` or `## Requisitos no funcionales`), each list item written as `<characteristic> (<module>, …): <statement>` with the parenthesis optional; and SHALL report, on `specgate propose --from-brief --check` and before a draft opens: as the error `B14_quality_unmeasured` an entry whose statement uses a word no test can check or promises a quantity with no number; as the error `B14_quality_module` an entry naming a module that `modules:` does not list; as the warning `B14_quality_shape` an item with no characteristic; and as the warning `B14_quality_characteristic` a characteristic that is not one of ISO/IEC 25010:2023's nine — functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, safety — nor a recognised alias of one, in English or Spanish, with a fix listing the nine. A brief with no such section SHALL get no finding about it.

#### Scenario: SCN-601a — A quality entry no test can check

- GIVEN a Lingo brief whose `## Quality` section says "- performance efficiency: The course list loads fast."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 1 with `B14_quality_unmeasured` naming the entry's line, and `specgate propose --from-brief courses` refuses with `brief_not_ready`

#### Scenario: SCN-601b — Measured entries, an alias and an unknown characteristic

- GIVEN a `## Quality` section saying "- performance (courses): The course list loads in under 2 seconds for 500 students at once.", "- disponibilidad: 99.5% each month." and "- beauty: Every screen uses the school's colours."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0, reports `B14_quality_characteristic` for beauty with a fix naming the nine characteristics, and reports nothing for the other two

#### Scenario: SCN-601c — An unknown module and no characteristic

- GIVEN a `## Quality` section saying "- security (billing): Card numbers are never stored." and "- Every page meets WCAG 2.2 AA."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it reports the error `B14_quality_module` for billing and the warning `B14_quality_shape` for the second item

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-601.feature kind=functional status=Approved -->

### Requirement: REQ-602 — Objectives with a success you can measure

The system SHALL report as the warning `B15_why_unmeasured` a brief whose `## Why` section (also `## Por qué`, `## Goals`, `## Objectives` or `## Objetivos`) says something and states no number, with a fix asking for the problem, the objectives and a success measured with a value and a unit; and SHALL report nothing when the section is absent or holds only comments.

#### Scenario: SCN-602a — A why with no number

- GIVEN a Lingo brief whose `## Why` says "Students lose track of their lessons. We want them to find them easily."
- WHEN the developer runs `specgate propose --from-brief --check`
- THEN it exits 0 and reports `B15_why_unmeasured`

#### Scenario: SCN-602b — A measured why, and a brief without one

- GIVEN one Lingo brief whose `## Why` says "A student finds today's lesson in under 10 seconds." and another with no `## Why` section
- WHEN the developer runs `specgate propose --from-brief --check` on each
- THEN neither reports a `B15` finding

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-602.feature kind=functional status=Approved -->

### Requirement: REQ-603 — Quality requirements reach the drafts

The system SHALL hand, in the `DRAFTING.md` of `specgate propose --from-brief <module>`, the `## Quality` entries that name that module, and — when the module is the first of `modules:` — the entries that name none, each to be written as a requirement of kind `non-functional` quoting its entry under `> Brief:`; SHALL hand no entry to any other module's draft; and SHALL write a `## Quality` section with commented examples and a `## Why` asking for a measurable success in the brief of `--new-brief`, ask in the guide an agent follows to propose a brief's sections for a `## Quality` section when the brief's text says how well the product must work, and name quality among what a good brief says when the project has no brief.

#### Scenario: SCN-603a — Scoped and product-wide entries

- GIVEN a Lingo brief with `modules: [courses, lessons]` whose `## Quality` says "- performance (lessons): A lesson opens in under 3 seconds." and "- reliability: Available 99.5% of each month."
- WHEN the developer runs `specgate propose --from-brief courses`, then `specgate propose --from-brief lessons`
- THEN courses' `DRAFTING.md` lists the reliability entry and not the performance one, and lessons' lists the performance entry and not the reliability one, each as a non-functional requirement to write

#### Scenario: SCN-603b — The new brief teaches both sections

- GIVEN a project with no brief
- WHEN the developer runs `specgate propose --from-brief --new-brief`
- THEN `docs/brief.md` has a `## Quality` section naming ISO/IEC 25010, a `## Why` asking for a success you can measure, and `specgate propose --from-brief --check` reports no `B14` or `B15` finding on it

<!-- specgate:trace actor=Developer feature=features/brief-cards/REQ-603.feature kind=functional status=Approved -->
