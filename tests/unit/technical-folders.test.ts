/**
 * technical-folders (issue #412, ADR-0041): folders named by the kind of code
 * they hold are not areas of the product (REQ-476); once adopted, onboard
 * points at a behaviour, not a folder (REQ-477); the adoption baseline names no
 * path that is not one (REQ-478).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "../helpers/cli";
import { proposeCapabilities } from "../../scripts/cli/commands/project/OnboardCommand";

/** A project whose `src/` holds these folders, one source file each — the issue's repro. */
function project(folders: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-412-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      name: "repro",
      scripts: { test: "vitest run" },
      devDependencies: { react: "*" },
    })
  );
  for (const f of folders) {
    fs.mkdirSync(path.join(dir, "src", f), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", f, "a.ts"), "export const x = 1;\n");
  }
  return dir;
}

const env = { ...process.env, CI: "1" };
const json = (args: string[]) => JSON.parse(runCli(args, { env }).stdout);

test("REQ-476 SCN-476a: a React CLI split by kind of code — onboard proposes no area and says why, adopt writes no areas, spec.md has REQ-001 alone", () => {
  const dir = project(["components", "keymap", "hooks", "utils", "data"]);
  try {
    assert.deepEqual(proposeCapabilities(dir), []);
    const onboard = json(["onboard", "--json", "--project-dir", dir]);
    assert.deepEqual(onboard.onboarding.capabilities, []);
    const why = (onboard.status as Array<{ code: string; message: string }>).find(
      (d) => d.code === "capabilities_by_kind"
    );
    assert.ok(why, JSON.stringify(onboard.status));
    assert.match(why.message, /components, hooks, utils/);

    const a = runCli(["adopt", "--yes", "--project-dir", dir], { env });
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.equal(fs.existsSync(path.join(dir, "docs", "specs", "adoption.md")), false);
    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.deepEqual(spec.match(/^## REQ-\d+/gm), ["## REQ-001"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-476 SCN-476b: areas beside a utils folder — Billing and Invoices, not Utils", () => {
  const dir = project(["billing", "invoices", "utils"]);
  try {
    assert.deepEqual(
      proposeCapabilities(dir)
        .map((c) => c.title)
        .sort(),
      ["Billing", "Invoices"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-476: the rule is a ratio, not a list — one kind-named folder among real areas does not silence them", () => {
  const dir = project(["orders", "payments", "catalog", "hooks"]);
  try {
    assert.deepEqual(
      proposeCapabilities(dir)
        .map((c) => c.title)
        .sort(),
      ["Catalog", "Orders", "Payments"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-477 SCN-477a: onboard on an adopted project with areas points at one behaviour, never `propose describe-<folder>`", () => {
  const dir = project(["billing", "invoices", "utils"]);
  try {
    assert.equal(runCli(["adopt", "--yes", "--project-dir", dir], { env }).status, 0);
    const onboard = json(["onboard", "--json", "--project-dir", dir]);
    assert.equal(onboard.onboarding.nextCommand, 'specgate new "<a behaviour you rely on>"');
    const text = runCli(["onboard", "--project-dir", dir], { env });
    assert.doesNotMatch(text.stdout + text.stderr, /propose describe-/);
    assert.match(text.stdout + text.stderr, /docs\/specs\/adoption\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-478 SCN-478a: plan right after adoption reports no missing `npm test` or `existing codebase` for REQ-001", () => {
  const dir = project(["billing"]);
  try {
    assert.equal(runCli(["adopt", "--yes", "--project-dir", dir], { env }).status, 0);
    const plan = json(["plan", "--format", "json", "--project-dir", dir]);
    const req1 = (plan.requirements as Array<Record<string, unknown>>).find(
      (r) => r.requirement === "REQ-001"
    )!;
    assert.ok(req1, JSON.stringify(plan));
    // Nothing declared, rather than a command and a phrase posing as paths: the
    // baseline still needs a test that names it, as any requirement does.
    assert.doesNotMatch(JSON.stringify(req1), /npm test|existing codebase/);
    assert.match(String(req1.technicalArtifact), /^-?$/);
    assert.match(String(req1.testArtifact), /^(-|TBD)?$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REQ-478: the harness leaves the adoption baseline out of a run — an agent cannot build existing behaviour — unless it is asked for by name", () => {
  const { harnessQueue } = require("../../scripts/cli/commands/harness/RunCommand") as {
    harnessQueue: (
      rows: Array<Record<string, string>>,
      reqs: string[]
    ) => Array<{ requirement: string }>;
  };
  const rows = [
    {
      requirement: "REQ-001",
      category: "NEEDS_EVERYTHING",
      featureFile: "`features/adoption/baseline.feature`",
    },
    {
      requirement: "REQ-002",
      category: "NEEDS_EVERYTHING",
      featureFile: "`features/orders/REQ-002.feature`",
    },
    {
      requirement: "REQ-002",
      category: "NEEDS_EVERYTHING",
      featureFile: "`features/orders/REQ-002.feature`",
    },
    { requirement: "REQ-003", category: "DONE", featureFile: "`features/orders/REQ-003.feature`" },
  ];
  assert.deepEqual(
    harnessQueue(rows, []).map((r) => r.requirement),
    ["REQ-002"]
  );
  assert.deepEqual(
    harnessQueue(rows, ["REQ-001"]).map((r) => r.requirement),
    ["REQ-001"]
  );
});
