/**
 * questions-options: each open question carries its options in
 * `questions --json` and the API (REQ-479); a threshold named without its
 * value is flagged by the brief check (REQ-480).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";
import { unmeasured } from "../../packages/core/src/domain/DraftChecklist";

const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");

function shop(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-qopt-"));
  const init = runCli([
    "init",
    "--config",
    path.join(FIXTURE, "project.yaml"),
    "--out",
    parent,
    "--no-git",
    "--no-agents",
    "--no-ci",
  ]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, "my-spec-driven-app");
  fs.cpSync(
    path.join(FIXTURE, "draft-orders"),
    path.join(dir, "docs", "specs", "changes", "draft-orders"),
    { recursive: true }
  );
  return dir;
}

test("REQ-479 SCN-479a: Q2 carries its two options in `questions --json` and in the API", async () => {
  const dir = shop();
  try {
    const r = runCli(["questions", "--json", "--project-dir", dir]);
    const doc = JSON.parse(r.stdout);
    const q2 = doc.questions.open.find((q: { id: string }) => q.id === "Q2");
    assert.ok(q2, r.stdout);
    assert.deepEqual(q2.options, ["before shipping", "within 24 h"]);
    const viaApi = await api.questions(dir);
    assert.deepEqual(viaApi.questions.open.find((q) => q.id === "Q2")!.options, [
      "before shipping",
      "within 24 h",
    ]);
    assert.deepEqual(viaApi, doc, "the API answers what the command prints");
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});

test("REQ-480: a threshold named without its value is unmeasured — in English, Spanish and German", () => {
  for (const text of [
    "Shipping is free above some amount.",
    "A discount applies from a certain number of items.",
    "El envío es gratis a partir de cierto importe.",
    "Ab einem bestimmten Betrag ist der Versand kostenlos.",
  ]) {
    assert.ok(unmeasured(text), text);
  }
  for (const text of [
    "Shipping is free above 50 €.",
    "A customer cancels an order before it ships.",
  ]) {
    assert.ok(!unmeasured(text), text);
  }
});

test('REQ-480 SCN-480a: the brief check flags "free above some amount" with B6_unmeasured, and not "free above 50 €"', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-b6-"));
  try {
    fs.mkdirSync(path.join(dir, "docs"));
    fs.writeFileSync(
      path.join(dir, "docs", "brief.md"),
      [
        "---",
        "product: Shop",
        "actors:",
        "  - { name: Customer }",
        "modules: [orders]",
        "---",
        "",
        "# Shop",
        "",
        "## Module: orders",
        "",
        "Rules",
        "",
        "- When a Customer orders, shipping is free above some amount.",
        "- When a Customer orders above 50 €, shipping is free.",
        "",
        "Examples",
        "",
        "- The one where a Customer orders for 60 € and pays no shipping.",
        "",
      ].join("\n")
    );
    const r = runCli(["propose", "--from-brief", "--check", "--json", "--project-dir", dir]);
    const findings = (
      JSON.parse(r.stdout).status as Array<{ code: string; message: string }>
    ).filter((f) => f.code === "B6_unmeasured");
    assert.equal(findings.length, 1, JSON.stringify(findings));
    assert.match(findings[0]!.message, /some amount/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
