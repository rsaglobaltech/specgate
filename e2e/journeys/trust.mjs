/** Trust levels per module (ADR-0046): declared, lowered by a bug, promoted by an approved change. */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

const SPEC = `# catalogo

## Requirements

### Requirement: REQ-050 — Show a product's price

<!-- specgate:trace status=Draft actor=Customer kind=functional -->

The system SHALL show each product's price.

#### Scenario: SCN-050 — A price shown

- GIVEN a product priced 10
- WHEN the customer opens it
- THEN the price 10 is shown
`;

export default [
  {
    name: "trust: a bug lowers catalogo, a promotion raises it once approved",
    covers: ["trust"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "docs/specs/capabilities/catalogo/spec.md", SPEC);
      t.write(dir, ".specgate/gate.yaml", "preset: standard\ntrust:\n  catalogo: 3\n  promote_after: 1\n");
      const listed = t.sg(dir, "trust", "--json");
      t.ok(listed, "trust --json");
      const row = t.json(listed).trust.capabilities.find((c) => c.capability === "catalogo");
      t.expect(row && row.level === 3 && row.name === "verified", "catalogo at 3, verified", listed);

      const bug = t.sg(dir, "propose", "fix-precio", "--kind", "bug", "--capability", "catalogo", "--json");
      t.ok(bug, "propose --kind bug");
      t.expect(t.json(bug).trust.to === 2, "the bug lowered catalogo to 2", bug);

      const promote = t.sg(dir, "trust", "promote", "catalogo", "--json");
      t.ok(promote, "trust promote");
      t.expect(t.json(promote).trust.promote.change === "trust-catalogo-3", "the promotion change opened", promote);
      const gate = t.read(dir, ".specgate/gate.yaml");
      t.expect(/catalogo: 2/.test(gate), "the level waits for the approval", promote);
    },
  },
];
