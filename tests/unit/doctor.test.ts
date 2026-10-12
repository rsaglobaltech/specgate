// specgate:allow-placeholders — this file emits or asserts on {{VAR}} template syntax.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = require("node:path").resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI_PATH = path.join(ROOT_DIR, "bin", "specgate.js");

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";

function cli(...args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function makeHealthyProject(tmp) {
  const dir = path.join(tmp, "project");
  fs.mkdirSync(path.join(dir, "features"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "specs", "adr"), { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.md"), "# Spec\n\n## REQ-001 — Health\n", "utf8");
  fs.writeFileSync(path.join(dir, "AI_RULES.md"), "# Rules\n", "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "# Readme\n", "utf8");
  fs.writeFileSync(path.join(dir, "docs", "specs", "adr", "README.md"), "# ADRs\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "features", "health.feature"),
    "Feature: Health\n  Scenario: ok\n    Given up\n    Then 200\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "docs", "specs", "traceability.md"),
    [
      "# Traceability Matrix",
      "",
      RICH_HEADER,
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| REQ-001 | SCN-001 | `features/health.feature` | UC-001 | - | - | - | - | TBD | Draft |",
      "",
    ].join("\n"),
    "utf8"
  );
  return dir;
}

function withProject(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-doctor-"));
  try {
    return fn(makeHealthyProject(tmp), tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("doctor passes on a healthy project", () => {
  withProject((dir) => {
    const r = cli("doctor", "--project-dir", dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /✔  Node\.js/);
    assert.match(r.stdout, /✔  SDD structure/);
    assert.match(r.stdout, /0 error\(s\)/);
  });
});

test("doctor reports ALL problems at once, each with a fix", () => {
  withProject((dir) => {
    // Problem 1: orphan feature (no matrix row).
    fs.writeFileSync(
      path.join(dir, "features", "orphan.feature"),
      "Feature: Orphan\n  Scenario: o\n    Given x\n    Then y\n",
      "utf8"
    );
    // Problem 2: dangling matrix row (feature file deleted).
    fs.appendFileSync(
      path.join(dir, "docs", "specs", "traceability.md"),
      "| REQ-002 | SCN-002 | `features/gone.feature` | UC-002 | - | - | - | - | TBD | Draft |\n"
    );
    // Problem 3: unresolved placeholder.
    fs.appendFileSync(path.join(dir, "AI_RULES.md"), "\nStack: {{STACK}}\n");

    const r = cli("doctor", "--project-dir", dir);
    assert.equal(r.status, 1);
    // All three reported in a single run (validate would stop at the first).
    assert.match(r.stdout, /orphan feature\s+features\/orphan\.feature/);
    assert.match(r.stdout, /dangling matrix row\s+.*features\/gone\.feature/);
    assert.match(r.stdout, /placeholders\s+unresolved .* in AI_RULES\.md/);
    // Every error line is followed by a fix.
    const errorCount = (r.stdout.match(/✖ /g) || []).length;
    const fixCount = (r.stdout.match(/fix:/g) || []).length;
    assert.ok(fixCount >= errorCount, `expected >= ${errorCount} fixes, got ${fixCount}`);
  });
});

test("doctor warns on spec/matrix requirement drift in both directions", () => {
  withProject((dir) => {
    fs.appendFileSync(path.join(dir, "spec.md"), "\n## REQ-010 — Only in spec\n");
    fs.appendFileSync(
      path.join(dir, "docs", "specs", "traceability.md"),
      "| REQ-020 | SCN-020 | `features/health.feature` | UC-020 | - | - | - | - | TBD | Draft |\n"
    );
    const r = cli("doctor", "--project-dir", dir);
    assert.equal(r.status, 0, "drift is a warning, not an error");
    assert.match(r.stdout, /REQ-010 is in spec\.md but has no traceability row/);
    assert.match(r.stdout, /REQ-020 is in traceability\.md but spec\.md has no section/);
  });
});

test("doctor on a non-spec-driven directory points to adopt/init", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-doctor-bare-"));
  try {
    const r = cli("doctor", "--project-dir", tmp);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not spec-driven yet/);
    assert.match(r.stdout, /adopt/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("doctor flags a corrupt .specops.lock", () => {
  withProject((dir) => {
    fs.writeFileSync(path.join(dir, ".specops.lock"), "{not json", "utf8");
    const r = cli("doctor", "--project-dir", dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /\.specops\.lock is not valid JSON/);
    assert.match(r.stdout, /fix: Restore it from git history/);
  });
});

// ── The scaffold's starter requirement, after a pack lands ───────────────────
//
// `init` seeds REQ-000 with a health scenario; a pack installed afterwards
// brings its own requirements, often including its own health one. The two sit
// side by side because `include_existing_rows` carries the old row forward.
// specgate-studio-app hit exactly this: REQ-000 and the pack's REQ-015 both
// describing deployment health.

/**
 * A healthy project that also carries the scaffold's starter requirement.
 * Built on makeHealthyProject because `doctor` stops at the first structural
 * error — a minimal fixture never reaches this check.
 */
function withSampleReq(fn, opts?: { row?: string; lock?: boolean }) {
  return withProject((dir) => {
    fs.mkdirSync(path.join(dir, "features", "core"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "features", "core", "health.feature"),
      "Feature: Health\n  Scenario: ok\n    Given up\n    Then 200\n",
      "utf8"
    );
    const row =
      opts?.row ??
      "| REQ-000 | SCN-000 | `features/core/health.feature` | UC-000 Health baseline | QRY-000 | - | - | `API /health` | TBD | Draft |";
    const tracePath = path.join(dir, "docs", "specs", "traceability.md");
    fs.appendFileSync(tracePath, row + "\n", "utf8");
    if (opts?.lock !== false) {
      fs.writeFileSync(
        path.join(dir, ".specops.lock"),
        JSON.stringify({
          specops_version: 1,
          packs: [{ repo: "r", pack_id: "backend", version: "v1" }],
        }),
        "utf8"
      );
    }
    return fn(dir);
  });
}

test("doctor flags the starter requirement once a pack is installed", () => {
  withSampleReq((dir) => {
    const r = cli("doctor", "--project-dir", dir);
    const out = r.stdout + r.stderr;
    assert.match(out, /sample requirement/);
    assert.match(out, /--no-sample-req/, "the fix must name the flag that prevents it");
  });
});

test("doctor says nothing about it when no pack is installed", () => {
  // Without a pack the starter requirement is the point, not a leftover.
  withSampleReq(
    (dir) => {
      const r = cli("doctor", "--project-dir", dir);
      assert.doesNotMatch(r.stdout + r.stderr, /REQ-000 is the scaffold/);
    },
    { lock: false }
  );
});

test("doctor leaves an adapted REQ-000 alone", () => {
  // Someone who filled the row in has adopted it; it is theirs now.
  withSampleReq(
    (dir) => {
      const r = cli("doctor", "--project-dir", dir);
      assert.doesNotMatch(r.stdout + r.stderr, /REQ-000 is the scaffold/);
    },
    {
      row: "| REQ-000 | SCN-000 | `features/core/health.feature` | UC-000 Invoicing | CMD-001 | AGG-001 | EVT-001 | src/invoice.ts | tests/invoice.test.ts | Implemented |",
    }
  );
});

// ── Which installation am I running? ─────────────────────────────────────────
//
// A user installed "the latest" and `-v` kept printing 0.1.2. The tool was
// right — it *was* 0.1.2, from a global install made months earlier. `npx
// create-spec-driven-app@latest` runs a temporary copy and never touches a
// global one, so the two answer different questions and nothing said so.
//
// Naming the installation is the whole fix. No network call: which version is
// newest is not doctor's business, and a lookup would break the offline and
// air-gapped modes the tool promises.

/**
 * The directories an install actually contains, taken from `files` in
 * package.json rather than listed again here. Naming them twice is how this
 * fixture drifts: it kept passing while the real tarball was missing a
 * directory the CLI requires.
 */
function shippedCodeDirs(): string[] {
  const files: string[] = require(path.join(ROOT_DIR, "package.json")).files || [];
  return files
    .map((entry) => entry.replace(/\/$/, ""))
    .filter((entry) => entry === "bin" || entry.startsWith("dist/"));
}

function installLayout(relative) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-layout-"));
  const pkgDir = path.join(root, ...relative.split("/"));
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, "package.json"),
    JSON.stringify({ name: "create-spec-driven-app", version: "9.9.9", engines: { node: ">=22" } })
  );
  for (const dir of shippedCodeDirs()) {
    const from = path.join(ROOT_DIR, ...dir.split("/"));
    if (!fs.existsSync(from)) continue;
    const to = path.join(pkgDir, ...dir.split("/"));
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
  }
  return { root, cli: path.join(pkgDir, "bin", "specgate.js") };
}

const LAYOUTS = [
  ["usr/local/lib/node_modules/create-spec-driven-app", "global install"],
  ["proj/node_modules/create-spec-driven-app", "project dependency"],
  [".npm/_npx/deadbeef/node_modules/create-spec-driven-app", "npx cache"],
];

for (const [relative, expected] of LAYOUTS) {
  test(`doctor names the installation it runs from: ${expected}`, () => {
    const { root, cli } = installLayout(relative);
    try {
      const r = spawnSync(process.execPath, [cli, "doctor", "--project-dir", ROOT_DIR], {
        encoding: "utf8",
      });
      const out = r.stdout + r.stderr;
      // The tool is called specgate. `doctor` was still labelling its own line
      // `specgate`, which a cold evaluator read as the tool not knowing its own name.
      assert.match(out, /specgate\s+v9\.9\.9/, "the version it is actually running");
      assert.ok(out.includes(expected), `expected "${expected}" in:\n${out.slice(0, 300)}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test("doctor prints the path, so a stale install is identifiable", () => {
  // The version alone does not tell you which copy to upgrade.
  const { root, cli } = installLayout("usr/local/lib/node_modules/create-spec-driven-app");
  try {
    const r = spawnSync(process.execPath, [cli, "doctor", "--project-dir", ROOT_DIR], {
      encoding: "utf8",
    });
    // Separator-agnostic: the report prints a native path, which is right for
    // the reader and backslashed on Windows. Asserting POSIX here is how this
    // test failed on two runners and nowhere else.
    const out = (r.stdout + r.stderr).split(path.sep).join("/");
    assert.match(out, /usr\/local\/lib\/node_modules/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("doctor reads the Node floor rather than repeating it", () => {
  // This check said ">= 20" for a whole release after the floor moved to 22.
  const engines = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).engines
    .node;
  const floor = Number(String(engines).replace(/[^0-9]/g, ""));
  const doctorSrc = fs.readFileSync(path.join(ROOT_DIR, "scripts", "doctor.ts"), "utf8");
  assert.doesNotMatch(
    doctorSrc,
    new RegExp(`major >= ${floor === 22 ? 20 : 22}\\b`),
    "the floor must not be hard-coded to a stale value"
  );
  assert.match(doctorSrc, /nodeFloor\(\)/, "the floor comes from package.json");
});
