/** Code changed with no requirement, and a contract read against the spec. */
import { spawnSync } from "node:child_process";

const git = (dir, ...args) =>
  spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=e2e@example.com", "-c", "user.name=E2E", ...args],
    { encoding: "utf8" }
  );

export default [
  {
    name: "drift names a commit that changed code and no requirement",
    covers: ["drift"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "start");
      const base = git(dir, "rev-parse", "HEAD").stdout.trim();

      t.write(
        dir,
        "src/orders/index.js",
        "module.exports = { total: (x) => Math.round(x * 1000) / 1000 };\n"
      );
      git(dir, "commit", "-qam", "round to the tenth of a cent");

      const drift = t.sg(dir, "drift", "--base", base, "--json");
      t.expect(drift.stdout.includes("spec_drift"), "the commit is named as drift", drift);
    },
  },
  {
    name: "contract check reads an OpenAPI contract against the requirements",
    covers: ["contract"],
    run(dir, t) {
      t.nodeRepo(dir);
      git(dir, "init", "-q");
      t.ok(t.sg(dir, "init"), "init");
      t.write(
        dir,
        "contracts/openapi.yaml",
        [
          "openapi: 3.0.3",
          "info:",
          "  title: Shop",
          "  version: 1.0.0",
          "paths:",
          "  /orders:",
          "    post:",
          "      operationId: createOrder",
          "      responses:",
          "        '201':",
          "          description: created",
          "",
        ].join("\n")
      );
      const check = t.sg(dir, "contract", "check", "--json");
      t.expect(
        check.stdout.includes("createOrder") && check.stdout.includes("api_operation_uncited"),
        "an operation no requirement cites is named",
        check
      );
    },
  },
];
