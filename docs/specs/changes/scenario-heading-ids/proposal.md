# Proposal: scenario-heading-ids

## Intent

specgate-studio's change `draft-changes` failed the gate on all three systems:
`[TDD-3] Requirement REQ-030 found in spec.md but has no row in
traceability.md`. REQ-030 was only named in a scenario's title — "Apply on
REQ-030 in the browser". `requirementSections` takes every id in any heading
from `##` to `####`, scenario headings included, so a title that mentions a
requirement declares it. Any project whose scenarios name another requirement
hits it.

## Scope

In scope: scenario headings declare no requirement.

Out of scope: other headings that mention an id in passing.

## Approach

`headingRequirementIds` skips a heading whose text starts with "Scenario".
Approved 2026-11-11 with the person leading specgate-studio.
