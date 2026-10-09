/** A draft change held to the checklist before anyone reviews it (ADR-0029). */

const BRIEF = `---
actors:
  - { name: Worker, surfaces: [api] }
---

Workers clock in inside a geofence of 100 m.
`;

const DELTA = `## ADDED Requirements

### Requirement: REQ-101 — Clock in inside the geofence

<!-- csda:trace kind=functional actor=Worker -->

The system SHALL accept a clock in inside the geofence.

#### Scenario: SCN-101 — Inside

- GIVEN a worker 40 m from the center of a 100 m geofence
- WHEN they POST /api/attendance/punches
- THEN the punch is accepted
`;

export default [
  {
    name: "draft --check finds a value nobody said, and passes once it is listed as an assumption",
    covers: ["draft"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "brief.md", BRIEF);
      t.write(
        dir,
        "docs/specs/changes/draft-attendance/change.yaml",
        "schema: spec-driven\nbrief: brief.md\n"
      );
      t.write(dir, "docs/specs/changes/draft-attendance/specs/attendance/spec.md", DELTA);

      const red = t.sg(dir, "draft", "--check", "draft-attendance", "--json");
      t.fails(red, "draft --check with an invented distance");
      t.expect(
        t.json(red).status.some((d) => d.code === "D6_unlisted_value" && d.target === "SCN-101"),
        "the 40 m the brief never said is named",
        red
      );

      t.write(
        dir,
        "docs/specs/changes/draft-attendance/assumptions.md",
        "| # | Assumption | Used in |\n|---|---|---|\n| A1 | A worker 40 m from the center | SCN-101 |\n"
      );
      t.ok(
        t.sg(dir, "draft", "--check", "draft-attendance"),
        "draft --check once it is an assumption"
      );
    },
  },
];
