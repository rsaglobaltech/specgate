/** The quality and security checks of the gate, by stage (REQ-218, REQ-219, ADR-0040). */

const CHECKS = `
checks:
  - name: lint
    run: "node -e process.exit(0)"
    runner: local
  - name: audit
    run: "node -e process.exit(1)"
    runner: local
    when: ci
`;

export default [
  {
    name: "list the checks, run a stage, and the ci stage fails only with --ci",
    covers: ["quality"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      let config = "harness_version: 1";
      try {
        config = t.read(dir, "harness.config.yaml").trimEnd();
      } catch {
        /* init wrote none: the checks are the whole file */
      }
      t.write(dir, "harness.config.yaml", config + CHECKS);
      const listed = t.sg(dir, "quality", "list", "--json");
      t.ok(listed, "quality list");
      t.expect(
        t
          .json(listed)
          .quality.checks.map((c) => c.name)
          .join(",") === "lint,audit",
        "both checks are listed, in the file's order",
        listed
      );
      t.ok(t.sg(dir, "quality", "run", "--json"), "quality run: attempt and end pass");
      const ci = t.sg(dir, "quality", "run", "--stage", "ci", "--json");
      t.expect(ci.status !== 0, "the ci stage fails on the failing audit", ci);
    },
  },
];
