"use strict";

/**
 * Guard: the two tiers of shipped pack say what they are.
 *
 * The eleven packs this repository shipped were called "curated domain packs"
 * on the landing page and in the docs. Each was four or five generic Draft
 * requirements and two to four template scenarios, and no product had ever
 * been built from one. The seven `proven` packs come from the six pilots: a
 * product implemented and tested every requirement they carry.
 *
 * What is pinned here is the difference between the two, so a pack cannot
 * call itself proven without saying what proved it, and an open question a
 * pilot could not answer cannot quietly become a Draft on install.
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
const PACKS_DIR = path.join(ROOT_DIR, "packs");
const { loadPack } = require("../../packages/core/src/infrastructure/DiskPackRepository");
const { validatePackModel } = require("../../packages/core/src/domain/PackSpec");

/** The seven packs derived from the pilots, and the pilot each came from. */
const PROVEN: Record<string, string> = {
  "ledger/backend": "FinCore",
  "transfers/backend": "FinCore",
  "event-registration/backend": "EventTech",
  "clinical-record/backend": "HealthTech",
  "appointment-booking/backend": "Bookings pilot",
  "shop-orders/backend": "Credit shop pilot",
  "time-attendance/backend": "Rebar Crew pilot",
};

function packIds(): string[] {
  const ids: string[] = [];
  for (const domain of fs.readdirSync(PACKS_DIR)) {
    const dir = path.join(PACKS_DIR, domain);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const type of fs.readdirSync(dir)) {
      if (fs.existsSync(path.join(dir, type, "pack.yaml"))) ids.push(`${domain}/${type}`);
    }
  }
  return ids.sort();
}

function run(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd });
}

function scaffold(withSample = false): { parent: string; projectDir: string } {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-proven-"));
  const init = run([
    "init",
    "--yes",
    ...(withSample ? [] : ["--no-sample-req"]),
    "--out",
    parent,
    "--no-git",
  ]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  return { parent, projectDir: path.join(parent, fs.readdirSync(parent)[0]) };
}

function expand(projectDir: string, id: string) {
  const r = run([
    "expand",
    "--pack-root",
    PACKS_DIR,
    "--pack",
    id,
    "--project-dir",
    projectDir,
    "--var",
    "PROJECT_NAME=Guard",
    "--var",
    "PROJECT_SLUG=guard",
    "--var",
    "DOMAIN=guard",
  ]);
  assert.equal(r.status, 0, `${id}: ${r.stdout}${r.stderr}`);
}

test("every pack declares its tier honestly: proven ones name their pilot, the rest are starters", () => {
  for (const id of packIds()) {
    const { pack } = loadPack(PACKS_DIR, id);
    const meta = pack.metadata || {};
    if (PROVEN[id]) {
      assert.equal(meta.tier, "proven", `${id} should declare tier: proven`);
      assert.ok(
        String(meta.provenance || "").includes(PROVEN[id]),
        `${id}: provenance should name the ${PROVEN[id]} pilot, got "${meta.provenance}"`
      );
      assert.match(
        meta.provenance,
        /implemented and tested/,
        `${id}: provenance should say what proved it`
      );
    } else {
      // A starter says nothing, or says starter. It never says proven.
      assert.notEqual(
        meta.tier,
        "proven",
        `${id} claims proven but is not one of the pilots' packs`
      );
    }
  }
  for (const id of Object.keys(PROVEN)) {
    assert.ok(packIds().includes(id), `the proven pack ${id} is missing from packs/`);
  }
});

test("a proven pack must say what proved it, and the tier is one of two words", () => {
  const { pack } = loadPack(PACKS_DIR, "ledger/backend");
  const exists = () => true;
  const without = JSON.parse(JSON.stringify(pack));
  delete without.metadata.provenance;
  assert.throws(() => validatePackModel(without, PACKS_DIR, exists), /provenance is empty/);

  const curated = JSON.parse(JSON.stringify(pack));
  curated.metadata.tier = "curated";
  assert.throws(
    () => validatePackModel(curated, PACKS_DIR, exists),
    /metadata.tier must be one of/
  );
});

test("every proven scenario has real steps and names its requirement and scenario", () => {
  for (const id of Object.keys(PROVEN)) {
    const { pack } = loadPack(PACKS_DIR, id);
    for (const scenario of pack.scenarios || []) {
      const body = fs.readFileSync(path.join(PACKS_DIR, id, scenario.template), "utf8");
      // Case-sensitive on purpose: `GIVEN` parses as prose and runs nothing.
      for (const keyword of ["Given ", "When ", "Then "]) {
        assert.match(
          body,
          new RegExp(`^\\s+${keyword}`, "m"),
          `${id} ${scenario.id}: no ${keyword.trim()}`
        );
      }
      assert.ok(
        !/\{\{|<placeholder>|TODO/i.test(body),
        `${id} ${scenario.id}: template placeholder left`
      );
      assert.ok(
        body.includes(`@${scenario.requirement_id} @${scenario.id}`),
        `${id} ${scenario.id}: the scenario is not tagged with its requirement and id`
      );
    }
  }
});

test("the proven packs do not reuse each other's ids, so a project can install all of them", () => {
  const seen = new Map<string, string>();
  for (const id of Object.keys(PROVEN)) {
    const { pack } = loadPack(PACKS_DIR, id);
    for (const item of [...(pack.requirements || []), ...(pack.scenarios || [])]) {
      assert.ok(!seen.has(item.id), `${item.id} is in both ${seen.get(item.id)} and ${id}`);
      seen.set(item.id, id);
    }
  }
});

test("all seven proven packs install into one project and the strict gate stays green", () => {
  // Into a project as `specgate init` makes it, with its derived matrix: one
  // row per tagged scenario. `init --no-sample-req` (what `init --from-pack`
  // runs) leaves a hand-kept matrix instead, which refuses a requirement with
  // two scenarios — open defect #86, documented in domain-packs.md.
  const { parent, projectDir } = scaffold(true);
  try {
    for (const id of Object.keys(PROVEN)) expand(projectDir, id);
    const v = run(["validate", projectDir, "--strict"]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("an open question a pilot left open is still open after install (defect #84)", () => {
  // HealthTech never chose an interaction database, and the merchant decides
  // the shipping rule. Both packs ship those requirements as Needs
  // Clarification. The matrix row is derived from the capability's trace line,
  // not from `status` in pack.yaml, so a pack that only set the latter
  // installed the question as Draft — and `done` would have closed it.
  // Both matrix modes: the derived one (what `init` makes, and where the
  // question was lost) and the hand-kept one.
  for (const derived of [true, false]) {
    const { parent, projectDir } = scaffold(derived);
    try {
      expand(projectDir, "clinical-record/backend");
      expand(projectDir, "shop-orders/backend");
      const matrix = fs.readFileSync(path.join(projectDir, "docs/specs/traceability.md"), "utf8");
      assert.equal(
        /specgate:derived/.test(matrix),
        derived,
        "the scaffold is not in the mode under test"
      );
      for (const req of ["REQ-409", "REQ-609"]) {
        const row = matrix.split("\n").find((l: string) => l.startsWith(`| ${req} |`));
        assert.ok(row, `no matrix row for ${req}`);
        assert.match(
          row,
          /\|\s*Needs Clarification\s*\|\s*$/,
          `${req} lost its open question (${derived ? "derived" : "hand-kept"}):\n  ${row}`
        );
      }
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
});
