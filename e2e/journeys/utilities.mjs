/** The commands around the loop: diagnosis, repair, reporting, preferences. */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "onboard reads a repository, proposes capabilities, and writes nothing",
    covers: ["onboard"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.write(dir, "src/billing/index.js", "module.exports = {};\n");
      const before = fs.readdirSync(dir).sort().join(",");
      const r = t.sg(dir, "onboard", "--json");
      t.ok(r, "onboard --json");
      const doc = t.json(r).onboarding;
      t.expect(doc.adopted === false, "a repo without spec.md is not adopted yet", r);
      t.expect(doc.stack.detectedFrom === "package.json", "the stack is read from package.json", r);
      t.expect(fs.readdirSync(dir).sort().join(",") === before, "onboard writes nothing");
    },
  },
  {
    name: "doctor passes a fresh adoption and names a fix for what breaks it",
    covers: ["doctor"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const clean = t.json(t.sg(dir, "doctor", "--json"));
      t.expect(clean.doctor.errors === 0, "no errors on a fresh adoption");
      fs.rmSync(path.join(dir, "AI_RULES.md"));
      const broken = t.sg(dir, "doctor", "--json");
      const doc = t.json(broken);
      t.expect(
        doc.doctor.errors > 0 || doc.doctor.warnings > 0,
        "a missing AI_RULES.md is reported",
        broken
      );
      t.expect(
        (doc.status || []).every((d) => d.severity === "info" || d.fix),
        "every finding carries a fix",
        broken
      );
    },
  },
  {
    name: "fix repairs an orphan feature in a hand-kept matrix, and has nothing to do in a generated one",
    covers: ["fix"],
    run(dir, t) {
      const hand = path.join(dir, "hand");
      t.nodeRepo(hand);
      t.ok(t.sg(hand, "adopt", "--keep-matrix", "--no-capabilities"), "adopt --keep-matrix");
      t.write(
        hand,
        "features/x/orphan.feature",
        "Feature: Orphan\n  Scenario: an orphan scenario here\n    Given a\n    When b\n    Then c\n"
      );
      t.fails(t.sg(hand, "validate", "."), "validate with an orphan feature");
      const preview = t.json(t.sg(hand, "fix", "--dry-run", "--json"));
      t.expect(
        preview.actions.some((a) => a.includes("orphan.feature")),
        "the dry run names the repair"
      );
      t.expect(
        !t.read(hand, "docs/specs/traceability.md").includes("orphan.feature"),
        "and writes nothing"
      );
      t.ok(t.sg(hand, "fix", "--yes"), "fix --yes");
      t.ok(t.sg(hand, "validate", "."), "validate after fix");

      const gen = path.join(dir, "gen");
      t.nodeRepo(gen);
      t.ok(t.sg(gen, "init"), "init");
      const r = t.sg(gen, "fix", "--yes");
      t.ok(r, "fix on a generated matrix");
      t.expect(/generated/.test(t.out(r)), "it says the matrix is generated", r);
    },
  },
  {
    name: "plan and report describe the same queue status does",
    covers: ["plan", "report"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const req = t.json(
        t.sg(dir, "new", "Coupons expire after thirty days", "--json")
      ).requirement;
      const plan = t.sg(dir, "plan", "--format", "json");
      t.ok(plan, "plan --format json");
      t.expect(plan.stdout.includes(req.id), "plan lists the new requirement", plan);

      const report = t.sg(dir, "report", "--format", "json", "--stdout");
      t.ok(report, "report --format json --stdout");
      t.expect(report.stdout.includes(req.id), "the report includes it", report);
      t.ok(t.sg(dir, "report", "--out", "coverage.html"), "report --out");
      t.expect(
        /<html/i.test(t.read(dir, "coverage.html")),
        "a self-contained HTML report is written"
      );
    },
  },
  {
    name: "req list, req done and req rm manage requirements without editing the matrix",
    covers: ["req list", "req done", "req rm"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const keep = t.deliverable(dir, "Totals are rounded to the cent");
      const drop = t.json(t.sg(dir, "new", "Gift wrapping is offered", "--json")).requirement;

      const list = t.json(t.sg(dir, "req", "list", "--json")).requirements.map((r) => r.id);
      t.expect(list.includes(keep.id) && list.includes(drop.id), "req list shows both", null);

      t.ok(t.sg(dir, "req", "done", keep.id, "--strict"), "req done --strict");
      t.expect(/\| Implemented \|$/.test(t.matrixRow(dir, keep.id)), "req done closes it");

      const preview = t.sg(dir, "req", "rm", drop.id, "--dry-run");
      t.ok(preview, "req rm --dry-run");
      t.expect(t.matrixRow(dir, drop.id) !== "", "the dry run removes nothing");
      t.ok(t.sg(dir, "req", "rm", drop.id), "req rm");
      t.expect(t.matrixRow(dir, drop.id) === "", "the row is gone");
      t.expect(!t.read(dir, "spec.md").includes(`## ${drop.id}`), "and its section in spec.md");
    },
  },
  {
    name: "config remembers a preference and the help follows it",
    covers: ["config init", "config set", "config get", "config list"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "config", "init"), "config init");
      t.expect(t.exists(dir, "project.yaml"), "config init writes project.yaml");
      t.ok(t.sg(dir, "config", "set", "profile", "full"), "config set profile full");
      const get = t.sg(dir, "config", "get", "profile");
      t.ok(get, "config get");
      t.expect(/full/.test(get.stdout), "the preference is read back", get);
      t.expect(
        /profile\s*=\s*full/.test(t.sg(dir, "config", "list").stdout),
        "config list shows it"
      );
      const help = t.sg(dir, "--help");
      t.expect(
        /specops add/.test(help.stdout),
        "with profile full, --help lists every command",
        help
      );
    },
  },
  {
    name: "schema creates, forks and validates a change workflow",
    covers: ["schema which", "schema init", "schema fork", "schema validate"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.expect(
        /spec-driven/.test(t.sg(dir, "schema", "which").stdout),
        "the default schema is spec-driven"
      );
      t.ok(t.sg(dir, "schema", "init", "myflow"), "schema init");
      t.ok(t.sg(dir, "schema", "fork", "bdd-first", "mybdd"), "schema fork");
      t.ok(t.sg(dir, "schema", "validate", "myflow"), "schema validate");
      t.expect(
        /myflow\s+\(project\)/.test(t.sg(dir, "schema", "which", "myflow").stdout),
        "which knows where it lives"
      );
    },
  },
  {
    name: "completion scripts know the commands, and studio exports the spec tree",
    covers: ["completion bash", "completion zsh", "completion fish", "studio"],
    run(dir, t) {
      for (const shell of ["bash", "zsh", "fish"]) {
        const r = t.sg(dir, "completion", shell);
        t.ok(r, `completion ${shell}`);
        t.expect(
          /specgate/.test(r.stdout) && /\bcheck\b/.test(r.stdout),
          `${shell} completion lists the commands`,
          r
        );
      }
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const model = t.sg(dir, "studio", "--json");
      t.ok(model, "studio --json");
      t.expect(t.json(model).schemaVersion === 1, "studio prints its model", model);
      t.ok(t.sg(dir, "studio", "--out", "studio-out"), "studio --out");
      t.expect(fs.readdirSync(path.join(dir, "studio-out")).length > 0, "studio exports a bundle");
    },
  },
];
