/** What a flow did before the change, kept beside the after (ADR-0047, REQ-803, REQ-804). */

export default [
  {
    name: "evidence: a requirement's run before its code kept, with what the runner wrote",
    covers: ["evidence"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.write(
        dir,
        "scenarios.js",
        [
          "const fs = require('fs');",
          "fs.mkdirSync('test-results/flow', { recursive: true });",
          "fs.writeFileSync('test-results/flow/before.png', 'png');",
          "process.exit(1);",
        ].join("\n") + "\n"
      );
      t.ok(t.sg(dir, "config", "set", "bdd_cmd", "node scenarios.js {tags}"), "config set bdd_cmd");
      const kept = t.sg(dir, "evidence", "before", "REQ-001", "--json");
      t.ok(kept, "evidence before");
      t.expect(t.json(kept).evidence.before[0].exitCode === 1, "red, as before the code", kept);
      t.expect(
        /"artifacts\/flow\/before\.png"/.test(t.read(dir, ".specgate/evidence/REQ-001/before/run.json")),
        "the runner's screenshot kept",
        kept
      );
      const usage = t.sg(dir, "evidence", "before", "checkout", "--json");
      t.expect(usage.status === 2 && /evidence_usage/.test(t.out(usage)), "a non-id refused", usage);
    },
  },
];
