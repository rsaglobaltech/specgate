"use strict";

/**
 * The change's evidence closes with it (change `evidence-archive`): archive
 * writes EVIDENCE.md and names a requirement with no before (REQ-813), and
 * the page takes the base the person names (REQ-814).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
import type { TestContext } from "node:test";
import { cli, json } from "../helpers/cli";
const { parseGatePolicy } = require("../../scripts/lib/gate-policy");

const requirement = (id: string, title: string, call: string) => [
  `### Requirement: ${id} — ${title}`,
  "",
  "<!-- specgate:trace actor=Member kind=functional status=Implemented -->",
  "",
  `The system SHALL handle ${title.toLowerCase()}.`,
  "",
  `#### Scenario: SCN-${id.slice(4)}a — ${title}`,
  "",
  "- GIVEN a member",
  `- WHEN the member sends ${call}`,
  "- THEN the response is 200",
  "",
];

/** An adopted project with draft-orders: REQ-031 with a before and an after, REQ-032 with only an after. */
function project(t: TestContext, policy: string) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-evidence-archive-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, "shop");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"shop","version":"1.0.0"}');
  assert.equal(cli("adopt", "--project-dir", dir, "--no-capabilities").status, 0);
  fs.writeFileSync(path.join(dir, ".specgate", "gate.yaml"), `preset: standard\n${policy}`);
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  fs.mkdirSync(path.join(change, "specs", "orders"), { recursive: true });
  fs.writeFileSync(
    path.join(change, "change.yaml"),
    "specgate_change_version: 1\nschema: layered\n"
  );
  fs.writeFileSync(
    path.join(change, "specs", "orders", "spec.md"),
    [
      "# Delta — orders",
      "",
      "## ADDED Requirements",
      "",
      ...requirement("REQ-031", "An order is paid", "POST /api/orders"),
      ...requirement("REQ-032", "An order is refunded", "POST /api/refunds"),
    ].join("\n")
  );
  const keep = (rel: string, file: string, exitCode: number) => {
    const folder = path.join(dir, ".specgate", "evidence", rel);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(
      path.join(folder, file),
      JSON.stringify({ command: "bdd", exitCode, artifacts: [] })
    );
  };
  keep("REQ-031/before", "run.json", 1);
  keep("REQ-031", "evidence.json", 0);
  keep("REQ-032", "evidence.json", 0);
  return dir;
}

const archived = (dir: string) => {
  const root = path.join(dir, "docs", "specs", "changes", "archive");
  if (!fs.existsSync(root)) return "";
  const name = fs.readdirSync(root).find((n: string) => n.endsWith("draft-orders"));
  return name ? path.join(root, name) : "";
};

test("REQ-813: the gate policy reads evidence: required or optional", () => {
  assert.equal(parseGatePolicy("evidence: required\n").evidence, "required");
  assert.equal(parseGatePolicy("evidence: optional\n").evidence, undefined);
  const bad = parseGatePolicy("evidence: always\n");
  assert.match(bad.problems[0].message, /evidence `always` is not required or optional/);
});

test("REQ-813 SCN-813a: archive writes the page into the archived change, and names a missing before", (t: TestContext) => {
  const dir = project(t, "bdd: required\n");
  const r = cli("archive", "draft-orders", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const doc = json(r);
  assert.equal(doc.archive.evidence.page, true);
  assert.deepEqual(doc.archive.evidence.noBefore, ["REQ-032"]);
  assert.ok(
    doc.archive.warnings.some((w: { code: string }) => w.code === "archive_no_before"),
    JSON.stringify(doc.archive.warnings)
  );
  const page = fs.readFileSync(path.join(archived(dir), "EVIDENCE.md"), "utf8");
  assert.match(page, /## REQ-031 — An order is paid/);
  assert.match(page, /## REQ-032[\s\S]*No before/);
});

test("REQ-813 SCN-813b: evidence: required refuses a requirement with no before, unless forced", (t: TestContext) => {
  const dir = project(t, "bdd: required\nevidence: required\n");
  const refused = cli("archive", "draft-orders", "--project-dir", dir, "--json");
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  const code = json(refused).status.find((s: { code: string }) => s.code === "archive_no_before");
  assert.ok(code, refused.stdout);
  assert.match(code.message, /REQ-032/);
  assert.match(code.fix, /--force/);
  assert.equal(archived(dir), "", "nothing archived");
  const forced = cli("archive", "draft-orders", "--force", "--project-dir", dir, "--json");
  assert.equal(forced.status, 0, forced.stdout + forced.stderr);
  assert.ok(fs.existsSync(path.join(archived(dir), "EVIDENCE.md")));
});

test("REQ-813: a project whose scenarios do not run writes no page at archive", (t: TestContext) => {
  const dir = project(t, "");
  const r = cli("archive", "draft-orders", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(json(r).archive.evidence, null);
  assert.ok(!fs.existsSync(path.join(archived(dir), "EVIDENCE.md")));
});

test("REQ-814 SCN-814a: evidence --base draws the base the person names", (t: TestContext) => {
  const dir = project(t, "bdd: required\n");
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args], {
      encoding: "utf8",
    });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  const order = (members: string) => `// REQ-031\nexport class Orders {\n${members}}\n`;
  fs.writeFileSync(path.join(dir, "src", "orders.ts"), order("  pay(): void {}\n"));
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "one");
  git("tag", "base-tag");
  fs.writeFileSync(
    path.join(dir, "src", "orders.ts"),
    order("  pay(): void {}\n  refund(): void {}\n")
  );
  git("commit", "-qam", "two");
  const r = cli("evidence", "draft-orders", "--base", "base-tag", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const page = fs.readFileSync(
    path.join(dir, "docs", "specs", "changes", "draft-orders", "EVIDENCE.md"),
    "utf8"
  );
  assert.match(page, /Changed: `Orders` — added `\+refund\(\)`/);
  const head = cli("evidence", "draft-orders", "--base", "HEAD", "--project-dir", dir);
  assert.equal(head.status, 0);
  assert.doesNotMatch(
    fs.readFileSync(
      path.join(dir, "docs", "specs", "changes", "draft-orders", "EVIDENCE.md"),
      "utf8"
    ),
    /Changed: `Orders`/,
    "against HEAD nothing changed"
  );
  const bad = cli("evidence", "draft-orders", "--base", "--project-dir", dir, "--json");
  assert.equal(bad.status, 2);
});

test("REQ-821 SCN-821a: on main, the page compares with the commit before the change was opened", (t: TestContext) => {
  const dir = project(t, "bdd: required\n");
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args], {
      encoding: "utf8",
    });
  const change = path.join(dir, "docs", "specs", "changes", "draft-orders");
  const aside = `${dir}-change`;
  fs.renameSync(change, aside);
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  const order = (members: string) => `// REQ-031\nexport class Orders {\n${members}}\n`;
  fs.writeFileSync(path.join(dir, "src", "orders.ts"), order("  pay(): void {}\n"));
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "before the change");
  fs.renameSync(aside, change);
  git("add", "-A");
  git("commit", "-q", "-m", "the change is opened");
  fs.writeFileSync(
    path.join(dir, "src", "orders.ts"),
    order("  pay(): void {}\n  refund(): void {}\n")
  );
  git("commit", "-qam", "delivered on main");
  const r = cli("evidence", "draft-orders", "--project-dir", dir, "--json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    fs.readFileSync(path.join(change, "EVIDENCE.md"), "utf8"),
    /Changed: `Orders` — added `\+refund\(\)`/,
    'not "unchanged since the base"'
  );
});
