/** Ways in: brownfield stacks, greenfield, and a hand-kept matrix migrated. */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "brownfield Python and Java are recognised by their manifests",
    covers: ["init", "check"],
    run(dir, t) {
      const py = path.join(dir, "py");
      t.write(py, "pyproject.toml", '[project]\nname = "billing"\n');
      t.write(py, "billing/__init__.py", "");
      const a = t.sg(py, "init");
      t.ok(a, "init on Python");
      t.expect(/pyproject\.toml/.test(t.out(a)), "detected from pyproject.toml", a);
      t.ok(t.sg(py, "check"), "check on Python");

      const java = path.join(dir, "java");
      t.write(java, "pom.xml", "<project><artifactId>clinic</artifactId></project>\n");
      t.write(java, "src/main/java/App.java", "class App {}\n");
      const b = t.sg(java, "init");
      t.ok(b, "init on Java");
      t.expect(/pom\.xml/.test(t.out(b)), "detected from pom.xml", b);
      t.ok(t.sg(java, "check"), "check on Java");
    },
  },
  {
    name: "an existing system: modules listed, one reversed into Draft requirements, old gaps baselined",
    covers: ["reverse", "check"],
    run(dir, t) {
      t.write(dir, "pom.xml", "<project><modules><module>orders</module></modules></project>\n");
      t.write(dir, "orders/pom.xml", "<project/>\n");
      t.write(dir, "orders/src/main/java/x/Cancel.java", "class Cancel {}\n");
      t.ok(t.sg(dir, "init"), "init on a Maven system");
      t.gitInit(dir);
      const list = t.sg(dir, "reverse", "--modules");
      t.ok(list, "reverse --modules");
      t.expect(/orders\s+java/.test(list.stdout), "orders is listed as java", list);

      const answer = {
        requirements: [
          {
            title: "A shipped order cannot be cancelled",
            text: "The system SHALL refuse to cancel an order whose status is SHIPPED.",
            source: ["orders/src/main/java/x/Cancel.java:1"],
            scenarios: [
              {
                title: "A shipped order",
                steps: ["GIVEN a shipped order", "WHEN it is cancelled", "THEN it is refused"],
              },
            ],
          },
        ],
      };
      const agent = path.join(dir, "..", "reverse-agent.cjs");
      fs.writeFileSync(
        agent,
        `const fs = require("node:fs");\nconst f = "docs/specs/changes/reverse-orders/reverse.json";\n` +
          `fs.mkdirSync(require("node:path").dirname(f), { recursive: true });\n` +
          `fs.writeFileSync(f, ${JSON.stringify(JSON.stringify(answer))});\n`
      );
      const before = t.read(dir, "spec.md");
      const r = t.sg(
        dir,
        "reverse",
        "orders",
        "--agent",
        `"${process.execPath}" "${agent}" {prompt_file}`
      );
      t.ok(r, "reverse orders");
      const delta = t.read(dir, "docs/specs/changes/reverse-orders/specs/orders/spec.md");
      t.expect(/status=Draft/.test(delta), "the requirement is Draft", r);
      t.expect(
        /source=orders\/src\/main\/java\/x\/Cancel\.java:1/.test(delta),
        "it cites its source",
        r
      );
      t.expect(t.read(dir, "spec.md") === before, "spec.md is untouched");

      const b = t.sg(dir, "check", "--baseline");
      t.ok(b, "check --baseline");
      t.expect(
        /recorded in docs\/specs\/gate-baseline\.json/.test(b.stdout),
        "the baseline is written",
        b
      );
    },
  },
  {
    name: "greenfield: init --yes scaffolds a project whose gate passes",
    covers: ["init", "check", "validate"],
    run(dir, t) {
      t.ok(t.sg(dir, "init", "--yes", "--no-git"), "init --yes");
      const project = fs.readdirSync(dir).find((d) => fs.statSync(path.join(dir, d)).isDirectory());
      const p = path.join(dir, project);
      t.expect(
        t.read(p, "docs/specs/traceability.md").includes("specgate:derived"),
        "matrix generated"
      );
      t.ok(t.sg(p, "check"), "check on the scaffold");
      t.ok(t.sg(p, "validate", ".", "--strict"), "validate --strict on the scaffold");
    },
  },
  {
    name: "a hand-kept matrix migrates row for row, or not at all",
    covers: ["adopt", "req add", "req link", "done", "matrix", "validate"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "adopt", "--keep-matrix", "--no-capabilities"), "adopt --keep-matrix");
      t.expect(
        !t.read(dir, "docs/specs/traceability.md").includes("specgate:derived"),
        "hand-kept"
      );
      t.ok(t.sg(dir, "req", "add", "Coupons expire"), "req add");
      t.realObligations(dir);
      t.write(dir, "test/coupon.test.js", "// coupons\n");
      t.ok(
        t.sg(
          dir,
          "req",
          "link",
          "REQ-002",
          "--test",
          "test/coupon.test.js",
          "--code",
          "src/orders/index.js"
        ),
        "req link"
      );
      t.ok(t.sg(dir, "done", "REQ-002"), "done");
      const before = t.read(dir, "docs/specs/traceability.md");

      const m = t.sg(dir, "matrix", "--migrate");
      t.ok(m, "matrix --migrate");
      t.expect(/identical row for row/.test(m.stdout), "migration reports a lossless result", m);
      const norm = (md) =>
        md
          .split("\n")
          .filter((l) => l.startsWith("| REQ-"))
          .map((l) => l.replace(/`/g, "").replace(/\| TBD \|/g, "| - |"));
      t.expect(
        JSON.stringify(norm(t.read(dir, "docs/specs/traceability.md"))) ===
          JSON.stringify(norm(before)),
        "rows identical after migration"
      );
      t.ok(t.sg(dir, "matrix", "--check"), "matrix --check");
      t.ok(t.sg(dir, "validate", "."), "validate after migration");
    },
  },
];
