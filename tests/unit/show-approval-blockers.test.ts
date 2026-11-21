/**
 * REQ-619: `change show --json` says what blocks approval — the blockers
 * `change approve` would refuse with — so a client says so before the person
 * presses Approve (Specgate Studio, #538).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

function sg(dir: string, args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args, "--project-dir", dir], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
}

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-blockers-"));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n\n## 8. Requirements\n", "utf8");
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  return dir;
}

const QUESTIONS = `# Questions

| ID | Question | Blocks | Answer |
| --- | --- | --- | --- |
| Q1 | How long is a parental session? | REQ-001 | |
`;

test("REQ-619 SCN-619a: a change approve would refuse — show lists the same blockers, each with its code, message and fix — Q1 open, floating", () => {
  const dir = project();
  try {
    assert.equal(sg(dir, ["change", "new", "parental", "--capability", "accounts"]).status, 0);
    fs.writeFileSync(path.join(dir, "docs/specs/changes/parental/questions.md"), QUESTIONS);
    const approve = JSON.parse(sg(dir, ["change", "approve", "parental", "--json"]).stdout);
    const refused = (approve.status || []).find(
      (d: { code: string }) => d.code === "approve_blocked"
    );
    assert.ok(refused, JSON.stringify(approve));
    const shown = JSON.parse(sg(dir, ["change", "show", "parental", "--json"]).stdout);
    const blockers = shown.change.blockers as Array<{
      code: string;
      message: string;
      fix?: string;
    }>;
    assert.ok(Array.isArray(blockers) && blockers.length > 0, JSON.stringify(shown.change));
    const floating = blockers.find((b) => b.code === "D7_floating_question");
    assert.ok(floating, JSON.stringify(blockers));
    assert.match(floating?.message ?? "", /Q1 blocks REQ-001/);
    assert.ok(floating?.fix, "each blocker carries its fix");
    for (const b of blockers) assert.ok(refused.message.includes(b.message), b.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-619 SCN-619b: a change nothing blocks — show says blockers: []", () => {
  const dir = project();
  try {
    assert.equal(sg(dir, ["change", "new", "pricing", "--capability", "pricing"]).status, 0);
    const shown = JSON.parse(sg(dir, ["change", "show", "pricing", "--json"]).stdout);
    const approve = JSON.parse(sg(dir, ["change", "approve", "pricing", "--json"]).stdout);
    const refused = (approve.status || []).some(
      (d: { code: string }) => d.code === "approve_blocked"
    );
    assert.deepEqual(shown.change.blockers, refused ? shown.change.blockers : []);
    if (!refused) assert.deepEqual(shown.change.blockers, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-628 SCN-628a: change show --json carries the change's use cases; null with no use-cases.md", () => {
  const dir = project();
  try {
    assert.equal(sg(dir, ["change", "new", "parental", "--capability", "accounts"]).status, 0);
    const none = JSON.parse(sg(dir, ["change", "show", "parental", "--json"]).stdout);
    assert.equal(none.change.useCases, null);
    fs.writeFileSync(
      path.join(dir, "docs/specs/changes/parental/use-cases.md"),
      "# Use cases\n\n## ADDED Use Cases\n\n| ID | Use Case | Actor | Requirements |\n| --- | --- | --- | --- |\n| UC-004 | Create a child profile | Tutor | REQ-001, REQ-002 |\n\n## REMOVED Use Cases\n\n| ID | Reason |\n| --- | --- |\n| UC-002 | Merged into UC-004 |\n"
    );
    const shown = JSON.parse(sg(dir, ["change", "show", "parental", "--json"]).stdout);
    assert.deepEqual(shown.change.useCases, {
      added: [
        {
          id: "UC-004",
          name: "Create a child profile",
          actor: "Tutor",
          requirements: ["REQ-001", "REQ-002"],
        },
      ],
      modified: [],
      removed: [{ id: "UC-002", reason: "Merged into UC-004" }],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
