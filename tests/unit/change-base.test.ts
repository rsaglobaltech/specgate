/**
 * change_base_moved — a change never replaces a requirement that moved under
 * it (REQ-168). Found rehearsing PET-103 and PET-104, which both rewrite
 * REQ-009: once PET-103 merged, PET-104's delta would have archived its rewrite
 * of the old text over PET-103's, with a green gate and no conflict.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

function git(dir: string, ...args: string[]) {
  const r = spawnSync(
    "git",
    ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=T", ...args],
    { encoding: "utf8" }
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function cli(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", SPECGATE_BASE: "" },
  });
}

const codes = (r: { stdout: string }) =>
  (JSON.parse(r.stdout).status as { code: string; message: string }[]) ?? [];

const OLD = "An owner's telephone is exactly 10 digits";
const NEW = "An owner's telephone is 10 digits, or an international number";

const requirement = (title: string, status = "Implemented") =>
  [
    `### Requirement: REQ-009 — ${title}`,
    "",
    `The system SHALL accept a telephone when ${title.toLowerCase()}.`,
    "",
    "#### Scenario: SCN-009a — Ten digits are accepted",
    "",
    '- GIVEN the owner form filled in for "George Franklin"',
    '- WHEN the receptionist saves the telephone "6085551023"',
    "- THEN the owner is saved",
    "",
    `<!-- specgate:trace actor=Receptionist kind=business-rule status=${status} -->`,
    "",
  ].join("\n");

function writeCapability(dir: string, title: string, status?: string) {
  const file = path.join(dir, "docs", "specs", "capabilities", "owners", "spec.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# Owners\n\n## Requirements\n\n${requirement(title, status)}`);
}

function writeDelta(dir: string, title: string) {
  const change = path.join(dir, "docs", "specs", "changes", "pet-104-walk-in");
  fs.mkdirSync(path.join(change, "specs", "owners"), { recursive: true });
  fs.writeFileSync(
    path.join(change, "specs", "owners", "spec.md"),
    `# Delta — owners\n\n## MODIFIED Requirements\n\n${requirement(title, "Draft")}`
  );
  if (!fs.existsSync(path.join(change, "change.yaml"))) {
    fs.writeFileSync(
      path.join(change, "proposal.md"),
      "# Proposal: pet-104-walk-in\n\n## Intent\n\nWalk-in owners may leave the telephone empty.\n"
    );
    fs.writeFileSync(
      path.join(change, "change.yaml"),
      "specgate_change_version: 1\nschema: spec-driven\nreq_range: [REQ-009, REQ-009]\n"
    );
  }
}

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-base-moved-"));
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n");
  writeCapability(dir, OLD);
  return dir;
}

const changeYaml = (dir: string) =>
  fs.readFileSync(
    path.join(dir, "docs", "specs", "changes", "pet-104-walk-in", "change.yaml"),
    "utf8"
  );

test("REQ-168: the gate records what a change rewrites the first time it sees it, without a warning", () => {
  const dir = project();
  try {
    writeDelta(dir, "An owner's telephone is 10 digits, or empty for a walk-in");
    const r = cli(dir, "check", "--json");
    assert.ok(!codes(r).some((d) => d.code === "change_base_moved"), r.stdout);
    assert.match(changeYaml(dir), /^based_on: \[REQ-009@[0-9a-f]{12}\]$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-168 SCN-168a: archive refuses a change whose requirement moved under it", () => {
  const dir = project();
  try {
    writeDelta(dir, "An owner's telephone is 10 digits, or empty for a walk-in");
    assert.equal(cli(dir, "change", "validate", "pet-104-walk-in").status, 0);
    writeCapability(dir, NEW);
    const before = fs.readFileSync(
      path.join(dir, "docs", "specs", "capabilities", "owners", "spec.md"),
      "utf8"
    );

    const check = cli(dir, "check", "--json");
    assert.ok(
      codes(check).some((d) => d.code === "change_base_moved" && d.message.includes("REQ-009")),
      check.stdout
    );

    const r = cli(dir, "archive", "pet-104-walk-in", "--json");
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const refused = codes(r).find((d) => d.code === "change_base_moved");
    assert.ok(refused, r.stdout);
    assert.match(refused.message, /REQ-009/);
    assert.equal(
      fs.readFileSync(path.join(dir, "docs", "specs", "capabilities", "owners", "spec.md"), "utf8"),
      before,
      "the capability spec is unchanged"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-168: a status flip on the requirement is not a move", () => {
  // apply on another branch flips the trace status; the text is the same.
  const dir = project();
  try {
    writeDelta(dir, "An owner's telephone is 10 digits, or empty for a walk-in");
    assert.equal(cli(dir, "change", "validate", "pet-104-walk-in").status, 0);
    writeCapability(dir, OLD, "Verified");
    const r = cli(dir, "check", "--json");
    assert.ok(!codes(r).some((d) => d.code === "change_base_moved"), r.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-168 SCN-168b: check warns before the branch has brought the moved requirement in", () => {
  const dir = project();
  try {
    git(dir, "init", "-q", "-b", "develop");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "REQ-009 as it stands");
    git(dir, "checkout", "-q", "-b", "feature/PET-104-walk-in");
    writeDelta(dir, "An owner's telephone is 10 digits, or empty for a walk-in");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "PET-104 docs(spec): draft the change");
    git(dir, "checkout", "-q", "develop");
    writeCapability(dir, NEW);
    git(dir, "commit", "-qam", "PET-103 merged");
    git(dir, "checkout", "-q", "feature/PET-104-walk-in");

    const r = cli(dir, "check", "--base", "develop", "--json");
    const moved = codes(r).find((d) => d.code === "change_base_moved");
    assert.ok(moved, r.stdout);
    assert.match(moved.message, /REQ-009/);
    assert.match(moved.message, /develop/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-168 SCN-168c: --rebased records the requirement as it reads now", () => {
  const dir = project();
  try {
    writeDelta(dir, "An owner's telephone is 10 digits, or empty for a walk-in");
    assert.equal(cli(dir, "change", "validate", "pet-104-walk-in").status, 0);
    writeCapability(dir, NEW);
    writeDelta(dir, "An owner's telephone is 10 digits, an international number, or empty");

    const rebased = cli(dir, "change", "validate", "pet-104-walk-in", "--rebased");
    assert.equal(rebased.status, 0, rebased.stdout + rebased.stderr);
    const r = cli(dir, "check", "--json");
    assert.ok(!codes(r).some((d) => d.code === "change_base_moved"), r.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
