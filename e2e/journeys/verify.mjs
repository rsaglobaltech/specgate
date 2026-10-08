/** A team on OpenSpec: its claims of done, gated on tests that name each scenario (ADR-0030). */

const SPEC = `# auth Specification

## Requirements
### Requirement: Sign in with a crew code
The system SHALL sign a worker in with their crew code.

#### Scenario: Valid code
- **WHEN** a worker enters a valid crew code
- **THEN** they are signed in
`;

const DELTA = `## ADDED Requirements
${SPEC.slice(SPEC.indexOf("### Requirement"))}`;

const ID = "openspec:auth/sign-in-with-a-crew-code/valid-code";

export default [
  {
    name: "verify fails an OpenSpec change archived without a test, and passes once a test names the scenario",
    covers: ["verify"],
    run(dir, t) {
      t.write(dir, "openspec/specs/auth/spec.md", SPEC);
      t.write(dir, "openspec/changes/archive/2026-10-08-crew-sign-in/specs/auth/spec.md", DELTA);
      t.write(
        dir,
        "openspec/changes/archive/2026-10-08-crew-sign-in/tasks.md",
        "- [x] 1.1 Sign-in\n"
      );
      t.git(dir, "init", "--quiet");

      const ids = t.sg(dir, "verify", "--ids");
      t.ok(ids, "verify --ids");
      t.expect(t.out(ids).includes(ID), "the scenario's id is printed to copy", ids);

      const red = t.sg(dir, "verify", "--json");
      t.fails(red, "verify with an archived change and no test");
      const doc = t.json(red);
      t.expect(
        doc.status.some((d) => d.code === "V1_unproved_claim" && d.target === ID),
        "the unproved scenario is named",
        red
      );

      t.write(dir, "test/auth.test.js", `// ${ID}\n`);
      t.ok(t.sg(dir, "verify", "--record"), "verify once a test names the scenario");
      t.expect(t.exists(dir, ".specgate/verify.lock"), "--record pins the verified text");
      t.expect(
        t.read(dir, "openspec/specs/auth/spec.md") === SPEC,
        "verify never writes to OpenSpec's files"
      );
    },
  },
];
