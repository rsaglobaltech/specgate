/** A requirement's scenarios run one by one through bdd_cmd (scenarios-run REQ-666). */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "scenarios: one passes, one fails — each with its line; no runner is refused",
    covers: ["scenarios"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(
        dir,
        "features/orders/REQ-031.feature",
        "Feature: Cancel an order\n\n  @REQ-031 @SCN-031a\n  Scenario: Before shipping\n    Given an order\n\n  @REQ-031 @SCN-031b\n  Scenario: After shipping\n    Given a shipped order\n"
      );
      const none = t.sg(dir, "scenarios", "REQ-031", "--json");
      t.expect(
        none.status !== 0 && /bdd_cmd_missing/.test(t.out(none)),
        "no bdd_cmd is refused",
        none
      );
      t.write(dir, "only-a.js", "process.exit(process.argv[2] === '@SCN-031a' ? 0 : 1);\n");
      t.ok(t.sg(dir, "config", "set", "bdd_cmd", "node only-a.js {tags}"), "config set bdd_cmd");
      const r = t.sg(dir, "scenarios", "REQ-031", "--json");
      t.fails(r, "scenarios with one red");
      const doc = t.json(r);
      const got = doc.scenarios.results.map((s) => `${s.id}:${s.passed}:${s.line}`).join(" ");
      t.expect(
        got === "SCN-031a:true:4 SCN-031b:false:8",
        `each scenario, its result and line: ${got}`,
        r
      );
    },
  },
];
