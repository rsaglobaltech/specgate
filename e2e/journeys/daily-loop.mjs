/** The five-verb daily loop and the gate. */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "the installed binary reports its version and the five-verb help",
    covers: [],
    run(dir, t) {
      const v = t.sg(dir, "--version");
      t.ok(v, "--version");
      t.expect(v.stdout.includes(t.version), `--version should print ${t.version}`, v);
      const help = t.sg(dir, "--help");
      t.ok(help, "--help");
      for (const verb of ["init", "status", "new", "check", "done"]) {
        t.expect(new RegExp(`\\b${verb}\\b`).test(help.stdout), `--help should list ${verb}`, help);
      }
      t.expect(!/\breq\s{2,}/.test(help.stdout), "--help should not list req any more", help);
      t.ok(t.sg(dir, "--help", "--all"), "--help --all");
    },
  },
  {
    name: "brownfield Node: init adopts, then new → test → done, no req link",
    covers: ["init", "new", "done", "check", "validate", "status"],
    run(dir, t) {
      t.nodeRepo(dir);
      const init = t.sg(dir, "init");
      t.ok(init, "init in a repo with code");
      t.expect(/Existing code found/.test(t.out(init)), "init should say it adopted", init);
      t.expect(
        t.read(dir, "src/orders/index.js").includes("Math.round"),
        "adopt must not touch code"
      );
      t.expect(
        t.read(dir, "docs/specs/traceability.md").includes("specgate:derived"),
        "matrix generated"
      );
      t.ok(t.sg(dir, "check"), "check on a fresh adoption");

      const created = t.sg(dir, "new", "Totals are rounded to the cent", "--json");
      t.ok(created, "new");
      const req = t.json(created).requirement;
      t.expect(t.exists(dir, req.featureFile), "new should write the feature file");

      // Plain `done`, as the help teaches it: it used to say ✔ here and leave
      // the next `check` — the one in CI — to fail on the same requirement.
      const premature = t.sg(dir, "done", req.id);
      t.fails(premature, "done on a scenario of placeholders");
      t.expect(
        /scenario_placeholder_step/.test(t.out(premature)),
        "the refusal names the placeholders",
        premature
      );

      t.fillScenario(dir, req.featureFile, [
        "an order totalling 10.005 EUR",
        "the total is computed",
        "the total is 10.01 EUR",
      ]);
      t.write(
        dir,
        "test/totals.test.js",
        `// ${req.id} ${req.scenarioId}\nrequire("node:test");\n`
      );
      fs.appendFileSync(
        path.join(dir, "src/orders/index.js"),
        `// ${req.id}: rounding to the cent\n`
      );

      t.ok(t.sg(dir, "done", req.id), "done once the scenario and a test that names it exist");
      t.expect(
        /\| test\/totals\.test\.js \| Implemented \|$/.test(t.matrixRow(dir, req.id)),
        "test derived"
      );
      t.expect(
        /`src\/orders\/index\.js`/.test(t.matrixRow(dir, req.id)),
        "code derived from its mention"
      );
      t.ok(t.sg(dir, "validate", ".", "--strict"), "validate --strict (what CI runs)");

      const status = t.sg(dir, "status", "--json");
      t.ok(status, "status --json");
      t.expect(
        t.json(status).counts.DONE >= 1,
        "status should count the delivered requirement",
        status
      );
    },
  },
  {
    name: "a stale generated matrix fails validate, and check repairs it",
    covers: ["validate", "check"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "new", "Orders can be cancelled"), "new");
      t.write(dir, "test/cancel.test.js", "// REQ-002\n");
      const v = t.sg(dir, "validate", ".", "--json");
      t.fails(v, "validate on a stale matrix");
      t.expect(v.stdout.includes("matrix_stale"), "the code is matrix_stale", v);
      t.sg(dir, "check");
      t.ok(t.sg(dir, "validate", "."), "validate after check regenerated");
    },
  },
  {
    name: "the gate refuses a delivered requirement whose test file is gone",
    covers: ["req link", "check"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const req = t.json(t.sg(dir, "new", "Refunds are logged", "--json")).requirement;
      t.fillScenario(dir, req.featureFile, [
        "a paid order",
        "it is refunded",
        "the refund is logged",
      ]);
      t.write(dir, "test/refund.test.js", `// ${req.id}\n`);
      t.ok(t.sg(dir, "done", req.id, "--strict"), "done --strict");
      // Pin the link explicitly, then delete the file: a rotted link.
      t.ok(t.sg(dir, "req", "link", req.id, "--test", "test/refund.test.js"), "req link");
      fs.rmSync(path.join(dir, "test/refund.test.js"));
      t.fails(
        t.sg(dir, "check", "--json"),
        "check with the delivered requirement's test file deleted"
      );
    },
  },
  {
    name: "check runs the project's tests, and fails when they fail",
    covers: ["check"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.write(dir, "fail.js", "process.exit(3);\n");
      t.write(dir, "pass.js", "process.exit(0);\n");
      t.fails(t.sg(dir, "check", "--test-cmd", "node fail.js"), "check with a failing suite");
      t.ok(t.sg(dir, "check", "--test-cmd", "node pass.js"), "check with a passing suite");
      t.write(dir, "harness.config.yaml", 'test_cmd: "node fail.js"\n');
      t.fails(t.sg(dir, "check"), "check reading test_cmd from harness.config.yaml");
    },
  },
];
