/** Unattended delivery: the harness drives an agent through the gate. */
import * as path from "node:path";

export default [
  {
    name: "harness run delivers a requirement on a generated matrix",
    covers: ["harness run"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const req = t.json(t.sg(dir, "new", "Totals are rounded to the cent", "--json")).requirement;
      t.fillScenario(dir, req.featureFile, [
        "an order totalling 10.005 EUR",
        "the total is computed",
        "the total is 10.01 EUR",
      ]);
      t.gitInit(dir);
      // An agent that does what the prompt asks: a test that names the
      // requirement, and the code. It is not allowed to edit the spec.
      const agent = path.join(path.dirname(dir), `agent-${path.basename(dir)}.js`);
      t.write(
        path.dirname(agent),
        path.basename(agent),
        [
          "const fs = require('node:fs');",
          "fs.mkdirSync('test', { recursive: true });",
          `fs.writeFileSync('test/totals.test.js', '// ${req.id} ${req.scenarioId}\\n');`,
          "fs.appendFileSync('src/orders/index.js', '// rounding\\n');",
        ].join("\n")
      );
      const r = t.sg(
        dir,
        "harness",
        "run",
        "--agent",
        `node "${agent}" {prompt_file}`,
        "--max-attempts",
        "1"
      );
      t.ok(r, "harness run");
      t.expect(
        new RegExp(`✅ ${req.id}\\s+pass`).test(t.out(r)),
        "the requirement passes the gate",
        r
      );
      t.expect(
        !/req link/.test(t.out(r)),
        "nothing tells the user to req link on a generated matrix",
        r
      );
      const branchMatrix = t.git(
        dir,
        "show",
        `harness/${req.id}:docs/specs/traceability.md`
      ).stdout;
      t.expect(
        branchMatrix.includes("test/totals.test.js"),
        "the branch's matrix links the agent's test"
      );
    },
  },
];
