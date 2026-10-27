/** Asking, listing and answering questions instead of editing tables (REQ-187..189). */

const DELTA = `## ADDED Requirements

### Requirement: REQ-101 — Clock in inside the geofence

<!-- specgate:trace kind=functional actor=Worker status=Draft -->

The system SHALL accept a clock in inside the geofence.

#### Scenario: SCN-101 — A punch inside the geofence

- GIVEN a worker inside the geofence
- WHEN they POST /api/attendance/punches
- THEN the punch is accepted
`;

export default [
  {
    name: "ask, list and answer a question; the draft waits until the answer is reviewed",
    covers: ["ask", "questions", "answer"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "docs/specs/changes/draft-attendance/change.yaml", "schema: spec-driven\n");
      t.write(dir, "docs/specs/changes/draft-attendance/specs/attendance/spec.md", DELTA);

      t.ok(t.sg(dir, "ask", "REQ-101", "How large is the geofence?"), "ask");
      const listed = t.sg(dir, "questions", "--json");
      t.ok(listed, "questions");
      t.expect(
        t.json(listed).questions.open.some((q) => q.id === "Q1" && q.blocks.includes("REQ-101")),
        "the question is listed with what it blocks",
        listed
      );

      t.ok(t.sg(dir, "answer", "Q1", "100 m around the site"), "answer");
      const waiting = t.sg(dir, "draft", "--check", "draft-attendance", "--json");
      t.expect(
        t.json(waiting).status.some((d) => d.code === "D13_assumption_to_review"),
        "the draft waits until the answer is in its spec",
        waiting
      );
      t.ok(t.sg(dir, "answer", "Q1", "--reviewed"), "answer --reviewed");
      const after = t.sg(dir, "draft", "--check", "draft-attendance", "--json");
      t.expect(
        !t.json(after).status.some((d) => d.code === "D13_assumption_to_review"),
        "once reviewed, the answer no longer holds the draft",
        after
      );
    },
  },
  {
    name: "a new requirement from the brief, and what a change to one touches",
    covers: ["brief add"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.write(
        dir,
        "docs/brief.md",
        "---\nactors:\n  - { name: Worker, surfaces: [api] }\nmodules: [attendance]\n---\n\n# Brief\n\nWorkers clock in.\n"
      );
      const added = t.sg(dir, "brief", "add", "attendance", "Workers clock out too", "--json");
      t.ok(added, "brief add");
      const doc = t.json(added).brief;
      t.expect(doc.change === "attendance-additions", "a change for the module", added);
      t.expect(
        t.read(dir, "docs/brief.md").includes("Workers clock out too"),
        "the brief keeps the line",
        added
      );
      t.fails(t.sg(dir, "brief", "add", "garage", "x"), "an unknown module is refused");
      const impact = t.sg(dir, "change", "impact", "attendance-additions", "--json");
      t.ok(impact, "change impact");
      t.expect(
        Array.isArray(t.json(impact).impact),
        "impact lists what the change touches",
        impact
      );
    },
  },
];
