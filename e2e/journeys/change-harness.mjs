/** Changing what already shipped, and unattended delivery around it. */
import * as fs from "node:fs";
import * as path from "node:path";
import { packRemote, project } from "./packs.mjs";

const VARS = ["--var", "PROJECT_NAME=Shop", "--var", "PROJECT_SLUG=shop", "--var", "DOMAIN=retail"];

function writeChange(dir, t, id, capability, reqId, featureRel) {
  const c = `docs/specs/changes/${id}`;
  t.write(
    dir,
    `${c}/proposal.md`,
    `# Proposal — ${id}\n\n## Why\n\nCustomers asked for it.\n\n## What changes\n\n- ${reqId}.\n\n## Impact\n\n- Capability: ${capability}\n`
  );
  t.write(
    dir,
    `${c}/specs/${capability}/spec.md`,
    [
      `# Delta — ${capability}`,
      "",
      "## ADDED Requirements",
      "",
      `### Requirement: ${reqId} — Coupons reduce the order total`,
      "",
      "The system SHALL reduce an order's total by the coupon's percentage.",
      "",
      "#### Scenario: A ten percent coupon on a 50 EUR order",
      "",
      "- GIVEN an order totalling 50 EUR",
      "- WHEN a 10% coupon is applied",
      "- THEN the total is 45 EUR",
      "",
      featureRel ? `<!-- csda:trace uc=UC-100 feature=${featureRel} -->` : "",
      "",
    ].join("\n")
  );
}

export default [
  {
    name: "a change from proposal to archive, then delivered like any requirement",
    covers: [
      "change new",
      "change status",
      "change instructions",
      "change validate",
      "change list",
      "change show",
      "change archive",
    ],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "change", "new", "add-coupons"), "change new");
      t.expect(
        /proposal/.test(t.sg(dir, "change", "status", "add-coupons").stdout),
        "status names the next artefact"
      );
      const ins = t.json(t.sg(dir, "change", "instructions", "specs", "--json"));
      t.expect(
        /ADDED Requirements/.test(JSON.stringify(ins)),
        "instructions carry the delta template"
      );

      writeChange(dir, t, "add-coupons", "billing", "REQ-002", "features/billing/coupons.feature");
      t.ok(t.sg(dir, "change", "validate", "add-coupons"), "change validate");
      t.expect(/add-coupons/.test(t.sg(dir, "change", "list").stdout), "change list shows it");
      t.expect(
        /REQ-002/.test(t.sg(dir, "change", "show", "add-coupons").stdout),
        "change show names the requirement"
      );

      t.fails(t.sg(dir, "change", "archive", "add-coupons"), "archive with unchecked tasks");
      const tasks = path.join(dir, "docs/specs/changes/add-coupons/tasks.md");
      fs.writeFileSync(tasks, fs.readFileSync(tasks, "utf8").replace(/- \[ \]/g, "- [x]"));
      t.ok(t.sg(dir, "change", "archive", "add-coupons", "--dry-run"), "archive --dry-run");
      t.expect(
        !t.exists(dir, "docs/specs/capabilities/billing/spec.md"),
        "the dry run writes nothing"
      );
      const archived = t.sg(dir, "change", "archive", "add-coupons");
      t.ok(archived, "change archive");
      t.expect(
        /1 materialised/.test(archived.stdout),
        "the delta's scenario becomes a feature file",
        archived
      );
      t.expect(
        /@REQ-002/.test(t.read(dir, "features/billing/coupons.feature")),
        "tagged with its requirement"
      );

      t.write(dir, "test/coupons.test.js", "// REQ-002\n");
      t.ok(t.sg(dir, "done", "REQ-002", "--strict"), "done --strict on an archived requirement");
      t.expect(
        /\| test\/coupons\.test\.js \| Implemented \|$/.test(t.matrixRow(dir, "REQ-002")),
        "linked by mention and closed"
      );
      t.ok(t.sg(dir, "validate", ".", "--strict"), "validate --strict");
    },
  },
  {
    name: "change author lets an agent write one artefact, and reverts anything outside the change",
    covers: ["change author"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "change", "new", "fix-x"), "change new");
      t.gitInit(dir);
      const agents = path.join(path.dirname(dir), `agents-${path.basename(dir)}`);
      t.write(
        agents,
        "good.js",
        "require('fs').writeFileSync('docs/specs/changes/fix-x/proposal.md', '# Proposal\\n\\n## Why\\n\\nBecause.\\n\\n## What changes\\n\\n- One thing.\\n');\n"
      );
      t.write(agents, "bad.js", "require('fs').writeFileSync('spec.md', '# hacked\\n');\n");

      const good = t.json(
        t.sg(
          dir,
          "change",
          "author",
          "fix-x",
          "--artifact",
          "proposal",
          "--agent",
          `node "${path.join(agents, "good.js")}" {prompt_file}`,
          "--json"
        )
      );
      t.expect(
        good.wrote.some((f) => f.endsWith("proposal.md")),
        "the agent's proposal is kept"
      );
      t.git(dir, "add", "-A");
      t.git(dir, "commit", "-qm", "proposal");

      const bad = t.json(
        t.sg(
          dir,
          "change",
          "author",
          "fix-x",
          "--artifact",
          "proposal",
          "--agent",
          `node "${path.join(agents, "bad.js")}" {prompt_file}`,
          "--json"
        )
      );
      t.expect(bad.reverted.includes("spec.md"), "the write outside the change is reverted");
      t.expect(
        bad.status.some((d) => d.code === "author_out_of_scope"),
        "and reported"
      );
      t.expect(!/hacked/.test(t.read(dir, "spec.md")), "spec.md is untouched");
    },
  },
  {
    name: "harness init, prompt before paying, run, and the report of what it cost",
    covers: ["harness init", "harness prompt", "harness run", "harness report"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      const req = t.json(t.sg(dir, "new", "Totals are rounded to the cent", "--json")).requirement;
      t.fillScenario(dir, req.featureFile, [
        "an order of 10.005 EUR",
        "the total is computed",
        "the total is 10.01 EUR",
      ]);
      t.ok(t.sg(dir, "harness", "init"), "harness init");
      t.expect(
        t.exists(dir, "harness.config.yaml") && t.exists(dir, ".harness/prompt-prefix.md"),
        "config and prompt prefix"
      );
      t.gitInit(dir);

      const prompt = t.sg(dir, "harness", "prompt", req.id);
      t.ok(prompt, "harness prompt");
      t.expect(
        prompt.stdout.includes(req.id) && /Totals are rounded/.test(prompt.stdout),
        "the prompt carries the requirement",
        prompt
      );

      const agent = path.join(path.dirname(dir), `agent-${path.basename(dir)}.js`);
      fs.writeFileSync(
        agent,
        `require('fs').mkdirSync('test',{recursive:true});require('fs').writeFileSync('test/totals.test.js','// ${req.id}\\n');\n`
      );
      const r = t.sg(
        dir,
        "harness",
        "run",
        "--req",
        req.id,
        "--agent",
        `node "${agent}" {prompt_file}`,
        "--max-attempts",
        "1"
      );
      t.ok(r, "harness run");

      const report = t.sg(dir, "harness", "report", "--json");
      t.ok(report, "harness report --json");
      t.expect(
        /attempted|requirements/.test(report.stdout) && report.stdout.includes("1"),
        "one run is recorded",
        report
      );
    },
  },
  {
    name: "a local change goes back upstream to the pack, on a branch, never pushed",
    covers: ["specops contribute"],
    run(dir, t) {
      const remote = packRemote(dir, t);
      const p = project(dir, t);
      t.ok(
        t.sg(
          p,
          "specops",
          "add",
          "--pack-repo",
          remote,
          "--pack-version",
          "v0.1.0",
          "--pack",
          "backend",
          ...VARS
        ),
        "specops add"
      );
      t.ok(t.sg(p, "change", "new", "tenant-export"), "change new");
      writeChange(p, t, "tenant-export", "backend", "REQ-006", null);
      t.ok(t.sg(p, "change", "validate", "tenant-export"), "change validate");

      const dry = t.sg(p, "specops", "contribute", "--change", "tenant-export", "--dry-run");
      t.ok(dry, "contribute --dry-run");
      t.expect(/REQ-006/.test(dry.stdout), "the dry run prints the pack fragment", dry);

      const clone = path.join(dir, "clone");
      t.ok(
        t.sg(p, "specops", "contribute", "--change", "tenant-export", "--out", clone),
        "contribute"
      );
      t.expect(
        /contribute\/tenant-export/.test(t.git(clone, "branch").stdout),
        "on its own branch"
      );
      t.expect(
        /REQ-006/.test(
          t.git(clone, "show", "--stat", "HEAD").stdout + t.git(clone, "show", "HEAD").stdout
        ),
        "the commit carries it"
      );
      t.expect(!/contribute/.test(t.git(remote, "branch", "-a").stdout), "and nothing was pushed");
    },
  },
];
