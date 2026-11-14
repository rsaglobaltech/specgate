/** The commands around the loop: diagnosis, repair, reporting, preferences. */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "a change as one page to send, loading nothing from outside it",
    covers: ["review"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "propose", "pdf"), "propose");
      t.ok(t.sg(dir, "review", "pdf", "--out", "review.html"), "review");
      const html = t.read(dir, "review.html");
      t.expect(/<!doctype html>/i.test(html), "an HTML page");
      t.expect(!/\b(src|href)\s*=/i.test(html), "nothing loaded from outside it");
    },
  },
  {
    name: "a change with a kind, accepted by a person, in the release notes and the guide",
    covers: ["release-notes", "acceptance", "guide"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.gitInit(dir);
      t.git(dir, "tag", "v0");
      t.ok(t.sg(dir, "propose", "pdf", "--kind", "enhancement"), "propose --kind");
      const delta = "docs/specs/changes/pdf/specs/pdf/spec.md";
      const id = /REQ-\d+/.exec(t.read(dir, "docs/specs/changes/pdf/change.yaml"))[0];
      t.write(
        dir,
        delta,
        `# Delta — pdf\n\n## ADDED Requirements\n\n### Requirement: ${id} — Invoices as PDF\n\n` +
          "The system SHALL offer an invoice as a PDF.\n\n#### Scenario: A paid invoice\n\n" +
          "- GIVEN a paid invoice\n- WHEN its owner downloads it\n- THEN a PDF arrives\n\n" +
          "<!-- specgate:trace status=Implemented actor=Customer kind=functional -->\n"
      );
      t.ok(t.sg(dir, "acceptance", "pdf"), "acceptance");
      const file = path.join(dir, "docs/specs/changes/pdf/acceptance.md");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("- [ ]", "- [x]"));
      t.ok(t.sg(dir, "acceptance", "pdf", "--sign", "Ana"), "acceptance --sign");

      const base = "docs/specs/changes/archive/2026-11-14-pdf";
      fs.mkdirSync(path.join(dir, "docs/specs/changes/archive"), { recursive: true });
      fs.renameSync(path.join(dir, "docs/specs/changes/pdf"), path.join(dir, base));
      t.git(dir, "add", "-A");
      t.git(dir, "commit", "-qm", "release");
      const notes = t.sg(dir, "release-notes", "v0..HEAD");
      t.ok(notes, "release-notes");
      t.expect(
        /## Enhancements[\s\S]*Invoices as PDF/.test(notes.stdout),
        "the change is listed",
        notes
      );
      t.ok(t.sg(dir, "guide"), "guide");
    },
  },
  {
    name: "a decision recorded then replaced, and the stack written down once",
    covers: ["adr new", "adr supersede", "adr list", "stack"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "adr", "new", "Use Postgres"), "adr new");
      const adr = fs
        .readdirSync(path.join(dir, "docs/specs/adr"))
        .find((f) => /-use-postgres\.md$/.test(f));
      t.expect(!!adr, "the ADR is written");
      const number = adr.slice(0, 4);
      const file = path.join(dir, "docs/specs/adr", adr);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Proposed", "Accepted"));
      t.ok(t.sg(dir, "adr", "supersede", number, "Use SQLite at the edge"), "adr supersede");
      const list = t.sg(dir, "adr", "list", "--json");
      t.ok(list, "adr list");
      const statuses = JSON.parse(list.stdout).adr.list.map((a) => a.status);
      t.expect(
        statuses.some((s) => /^Superseded by /.test(s)),
        "the old one is superseded",
        list
      );

      t.ok(t.sg(dir, "stack"), "stack");
      const once = t.read(dir, "docs/specs/stack.md");
      t.ok(t.sg(dir, "stack"), "stack again");
      t.expect(t.read(dir, "docs/specs/stack.md") === once, "a second run changes nothing");
    },
  },
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
      fs.rmSync(path.join(dir, "AGENTS.md"));
      const broken = t.sg(dir, "doctor", "--json");
      const doc = t.json(broken);
      t.expect(
        doc.doctor.errors > 0 || doc.doctor.warnings > 0,
        "a missing AGENTS.md is reported",
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
    name: "pet hatches from the first closed requirement and falls sick on a red gate",
    covers: ["pet"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const egg = t.json(t.sg(dir, "pet", "--json")).pet;
      t.expect(egg.stage === "egg", "nothing closed yet: an egg");
      t.expect(egg.next === "specgate check", "a cat that never saw the gate asks for check");
      t.sg(dir, "check");
      const after = t.json(t.sg(dir, "pet", "--json")).pet;
      t.expect(after.health !== null, "check tells the cat how the gate ended");
      t.expect(
        fs.readFileSync(path.join(dir, ".specgate", ".gitignore"), "utf8").includes("pet.json"),
        "the cat's state stays out of git"
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
    covers: ["config init", "config set", "config get", "config list", "config keys"],
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
      const keys = t.sg(dir, "config", "keys", "--json");
      t.ok(keys, "config keys");
      t.expect(
        JSON.parse(keys.stdout).keys.some((k) => k.key === "profile" && k.current === "full"),
        "config keys lists the preference with its value",
        keys
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
