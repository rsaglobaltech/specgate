"use strict";

/**
 * REQ-542, REQ-543, REQ-544, REQ-545 — release notes from what was archived,
 * acceptance a person signs, a user guide per actor, and a change's kind
 * (change transition-outputs).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");
const {
  deliveredBy,
  intentOf,
  renderReleaseNotes,
} = require("../../packages/core/src/domain/ReleaseNotes");
const {
  acceptanceItems,
  signed,
  signatureOf,
} = require("../../packages/core/src/domain/Acceptance");
const { actorSlug, renderGuide } = require("../../packages/core/src/domain/UserGuide");

const madeDirs: string[] = [];
require("node:test").after(() => {
  for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true });
});

function project() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-transition-"));
  madeDirs.push(parent);
  const r = spawnSync(process.execPath, [CLI, "init", "--yes", "--out", parent, "--no-git"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return path.join(parent, fs.readdirSync(parent)[0]);
}
const sg = (dir: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: r.status, out: r.stdout + r.stderr, stdout: r.stdout };
};
const put = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const git = (dir: string, ...args: string[]) =>
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
function gitInit(dir: string) {
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "seed");
}

// ── REQ-545 ─────────────────────────────────────────────────────────────────

test("REQ-545 SCN-545a: a bug from the command line", () => {
  const dir = project();
  const ok = sg(dir, "propose", "rounding", "--kind", "bug", "--json");
  assert.equal(ok.status, 0, ok.out);
  assert.match(
    fs.readFileSync(path.join(dir, "docs/specs/changes/rounding/change.yaml"), "utf8"),
    /^kind: bug$/m
  );
  const bad = sg(dir, "propose", "other", "--kind", "chore", "--json");
  assert.equal(bad.status, 1, bad.out);
  assert.equal(JSON.parse(bad.stdout).status[0].code, "change_kind_unknown");
  assert.equal(fs.existsSync(path.join(dir, "docs/specs/changes/other")), false);

  const show = JSON.parse(sg(dir, "change", "show", "rounding", "--json").stdout);
  assert.equal(show.change.kind, "bug");
  const list = JSON.parse(sg(dir, "change", "list", "--json").stdout);
  assert.equal(list.changes.find((c: { id: string }) => c.id === "rounding").kind, "bug");
});

test("REQ-545: propose --from-ticket takes the kind from the Jira issue type", () => {
  const dir = project();
  gitInit(dir);
  const kindOf = (key: string, type: string, summary: string) => {
    const ticket = path.join(path.dirname(dir), `${key}.json`);
    fs.writeFileSync(
      ticket,
      JSON.stringify({
        key,
        fields: {
          summary,
          issuetype: { name: type },
          description:
            'Acceptance Criteria\n- Given the form, when I save "+49301234567", then the owner is saved.',
        },
      })
    );
    const r = sg(dir, "propose", "--from-ticket", ticket, "--capability", "owners", "--no-push");
    assert.equal(r.status, 0, r.out);
    const change = fs
      .readdirSync(path.join(dir, "docs/specs/changes"))
      .find((c: string) => c.startsWith(key.toLowerCase()));
    return /^kind: (\w+)$/m.exec(
      fs.readFileSync(path.join(dir, "docs/specs/changes", change, "change.yaml"), "utf8")
    )?.[1];
  };
  assert.equal(kindOf("PET-1", "Bug", "Phone rejected"), "bug");
});

// ── REQ-542 ─────────────────────────────────────────────────────────────────

function archived(dir: string, folder: string, kind: string, req: string, title: string) {
  const base = `docs/specs/changes/archive/${folder}`;
  put(
    dir,
    `${base}/change.yaml`,
    `specgate_change_version: 1\nschema: spec-driven\nkind: ${kind}\n`
  );
  put(
    dir,
    `${base}/proposal.md`,
    `# Proposal\n\n## Intent\n\nWhy ${folder} matters,\nin two lines.\n\n## Scope\n\nx\n`
  );
  put(
    dir,
    `${base}/specs/billing/spec.md`,
    `# Delta — billing\n\n## ADDED Requirements\n\n### Requirement: ${req} — ${title}\n\nThe system SHALL do it.\n\n## REMOVED Requirements\n\n### Requirement: REQ-099 — Gone\n`
  );
}

test("REQ-542 SCN-542a: one enhancement and one bug between two tags", () => {
  const dir = project();
  gitInit(dir);
  git(dir, "tag", "v1.0.0");
  archived(dir, "2026-11-01-pdf-invoices", "enhancement", "REQ-007", "Invoices download as PDF");
  archived(dir, "2026-11-02-rounding", "bug", "REQ-009", "Totals round half-up");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "release");
  git(dir, "tag", "v1.1.0");

  const r = sg(dir, "release-notes", "v1.0.0..v1.1.0");
  assert.equal(r.status, 0, r.out);
  const enh = r.stdout.indexOf("## Enhancements");
  const fix = r.stdout.indexOf("## Fixes");
  assert.ok(enh >= 0 && fix > enh, r.stdout);
  assert.ok(
    r.stdout.indexOf("### pdf-invoices") > enh && r.stdout.indexOf("### pdf-invoices") < fix
  );
  assert.match(r.stdout, /- REQ-007 — Invoices download as PDF/);
  assert.ok(r.stdout.indexOf("### rounding") > fix);
  assert.match(r.stdout, /- REQ-009 — Totals round half-up/);
  assert.doesNotMatch(r.stdout, /REQ-099/, "a removed requirement was not delivered");
  assert.match(r.stdout, /Why 2026-11-01-pdf-invoices matters, in two lines\./);

  const out = sg(dir, "release-notes", "v1.0.0..v1.1.0", "--out", "RELEASE.md", "--json");
  assert.equal(JSON.parse(out.stdout).releaseNotes.changes.length, 2);
  assert.ok(fs.existsSync(path.join(dir, "RELEASE.md")));

  const unknown = sg(dir, "release-notes", "v0.9..v1.1.0", "--json");
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).status[0].code, "ref_unknown");
});

test("REQ-542: the rules, without a repository", () => {
  assert.equal(intentOf("# P\n\n## Intent\n\n\nOne.\nTwo.\n\nThree.\n"), "One. Two.");
  assert.deepEqual(
    deliveredBy("## MODIFIED Requirements\n\n### Requirement: REQ-002 — B\n").map(
      (r: { id: string }) => r.id
    ),
    ["REQ-002"]
  );
  const md = renderReleaseNotes("a", "b", [
    { id: "z", kind: "chore", intent: "", requirements: [] },
  ]);
  assert.match(md, /## Other changes\n\n### z/, "an unknown kind reads as none");
  assert.match(renderReleaseNotes("a", "b", []), /No change was archived/);
});

// ── REQ-543 ─────────────────────────────────────────────────────────────────

test("REQ-543 SCN-543a: signed only when every item is checked", () => {
  const dir = project();
  assert.equal(sg(dir, "propose", "pdf-invoices", "--json").status, 0);
  const cfg = fs.readFileSync(
    path.join(dir, "docs/specs/changes/pdf-invoices/change.yaml"),
    "utf8"
  );
  const id = /req_range: \[(REQ-\d+)/.exec(cfg)![1];
  put(
    dir,
    "docs/specs/changes/pdf-invoices/specs/pdf-invoices/spec.md",
    `# Delta — pdf-invoices\n\n## ADDED Requirements\n\n### Requirement: ${id} — Invoices download as PDF\n\n` +
      "The system SHALL offer an invoice as a PDF.\n\n" +
      `#### Scenario: SCN-${id.slice(4)}a — A paid invoice\n\n- GIVEN a paid invoice\n- WHEN its owner downloads it\n- THEN a PDF arrives\n\n` +
      `#### Scenario: SCN-${id.slice(4)}b — An unpaid invoice\n\n- GIVEN an unpaid invoice\n- WHEN its owner downloads it\n- THEN the PDF says unpaid\n\n` +
      "<!-- specgate:trace status=Implemented actor=Developer kind=functional -->\n"
  );
  const file = path.join(dir, "docs/specs/changes/pdf-invoices/acceptance.md");
  const w = sg(dir, "acceptance", "pdf-invoices", "--json");
  assert.equal(w.status, 0, w.out);
  assert.equal(JSON.parse(w.stdout).acceptance.open.length, 2);
  assert.match(fs.readFileSync(file, "utf8"), /- \[ \] A paid invoice\n {2}- GIVEN a paid invoice/);

  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace("- [ ] A paid invoice", "- [x] A paid invoice")
  );
  const early = sg(dir, "acceptance", "pdf-invoices", "--sign", "Ana Pérez", "--json");
  assert.equal(early.status, 1, early.out);
  assert.equal(JSON.parse(early.stdout).status[0].code, "acceptance_incomplete");
  assert.equal(signatureOf(fs.readFileSync(file, "utf8")), null);

  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace("- [ ] An unpaid invoice", "- [x] An unpaid invoice")
  );
  const ok = sg(dir, "acceptance", "pdf-invoices", "--sign", "Ana Pérez", "--json");
  assert.equal(ok.status, 0, ok.out);
  assert.deepEqual(JSON.parse(ok.stdout).acceptance.verified, [id]);
  assert.equal(signatureOf(fs.readFileSync(file, "utf8")).name, "Ana Pérez");
  assert.match(
    fs.readFileSync(
      path.join(dir, "docs/specs/changes/pdf-invoices/specs/pdf-invoices/spec.md"),
      "utf8"
    ),
    /status=Verified/
  );
});

test("REQ-543: items, signature and steps are told apart", () => {
  const md = "- [x] a\n  - GIVEN x\n- [ ] b\n- [X] c\n\n## Signed\n\n_Not yet._\n";
  assert.deepEqual(acceptanceItems(md), { checked: 2, open: ["b"] });
  assert.deepEqual(signatureOf(signed(md, "Bo", "2026-11-14")), { name: "Bo", date: "2026-11-14" });
});

// ── REQ-544 ─────────────────────────────────────────────────────────────────

test("REQ-544 SCN-544a: the customer's chapter", () => {
  const dir = project();
  const spec = path.join(dir, "spec.md");
  const req = (id: string, title: string, status: string, actor: string) =>
    `\n## ${id} — ${title}\n\n<!-- specgate:trace status=${status} actor=${actor} -->\n\nThe system SHALL ${title.toLowerCase()}.\n`;
  fs.appendFileSync(
    spec,
    req("REQ-001", "Show invoices", "Implemented", "Customer") +
      req("REQ-002", "Export invoices", "Draft", "Customer") +
      req("REQ-003", "Close the till", "Implemented", "Clerk")
  );
  put(
    dir,
    "features/billing/invoices.feature",
    "Feature: Invoices\n\n  @REQ-001 @SCN-001\n  Scenario: Seeing my invoices\n    Given I have two invoices\n    When I open my account\n    Then I see both\n"
  );
  const r = sg(dir, "guide", "--actor", "Customer", "--json");
  assert.equal(r.status, 0, r.out);
  const guide = fs.readFileSync(path.join(dir, "docs/guide/customer.md"), "utf8");
  assert.match(guide, /### Show invoices\n\n_REQ-001_/);
  assert.match(
    guide,
    /\*\*Seeing my invoices\*\*\n\n1\. Given I have two invoices\n2\. When I open my account\n3\. Then I see both/
  );
  assert.doesNotMatch(guide, /REQ-002|REQ-003/);
});

test("REQ-544: an actor's file name, and an actor with nothing delivered", () => {
  assert.equal(actorSlug("Fleet Manager"), "fleet-manager");
  assert.equal(actorSlug("Señora García"), "senora-garcia");
  assert.match(renderGuide("Nobody", []), /Nothing is delivered for Nobody yet/);
});
