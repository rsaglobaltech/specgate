/**
 * The dependency graph — the model behind H12.
 *
 * The invariant that matters most is the boring one: a project that declares
 * nothing must behave exactly as it did before. Everything else is ordering.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const {
  readDeclaredDependencies,
  splitDependencies,
  RequirementGraph,
  requirementGraphFromProject,
} = require("../../scripts/lib/requirement-graph");

const graphOf = (ids: string[], declared: Record<string, string[]>) =>
  RequirementGraph.fromDependencies(ids, declared);

function withCapability(spec: string, fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-graph-"));
  try {
    const capDir = path.join(dir, "docs", "specs", "capabilities", "billing");
    fs.mkdirSync(capDir, { recursive: true });
    fs.writeFileSync(path.join(capDir, "spec.md"), spec, "utf8");
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function requirement(id: string, trace = "") {
  return [
    `### Requirement: ${id} — ${id} title`,
    `The system SHALL do ${id}.`,
    "",
    `#### Scenario: SCN-${id.slice(4)} — happy path`,
    "- GIVEN a thing",
    "- WHEN it happens",
    "- THEN it works",
    trace ? `<!-- specgate:trace ${trace} -->` : "",
    "",
  ].join("\n");
}

function spec(...reqs: string[]) {
  return ["# Billing", "", "## Purpose", "", "Billing.", "", "## Requirements", "", ...reqs].join(
    "\n"
  );
}

// ── Declaration ───────────────────────────────────────────────────────────────

test("splitDependencies accepts commas, spaces and semicolons, and de-duplicates", () => {
  assert.deepEqual(splitDependencies("REQ-001, REQ-003"), ["REQ-001", "REQ-003"]);
  assert.deepEqual(splitDependencies("REQ-001 REQ-003"), ["REQ-001", "REQ-003"]);
  assert.deepEqual(splitDependencies("req-001;REQ-001"), ["REQ-001"]);
  assert.deepEqual(splitDependencies(""), []);
});

test("a requirement declares what it builds on inside its specgate:trace comment", () => {
  withCapability(
    spec(
      requirement("REQ-001", "uc=UC-001 feature=features/a.feature"),
      requirement("REQ-002", "uc=UC-002 feature=features/b.feature depends=REQ-001")
    ),
    (dir) => {
      assert.deepEqual(readDeclaredDependencies(dir), { "REQ-002": ["REQ-001"] });
    }
  );
});

test("a project that declares nothing produces an empty graph", () => {
  withCapability(spec(requirement("REQ-001"), requirement("REQ-002")), (dir) => {
    assert.deepEqual(readDeclaredDependencies(dir), {});
  });
});

test("a project with no capabilities directory is not an error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specgate-graph-"));
  try {
    assert.deepEqual(readDeclaredDependencies(dir), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a capability whose spec does not parse is skipped, not thrown on", () => {
  withCapability("this is not a spec at all", (dir) => {
    assert.deepEqual(readDeclaredDependencies(dir), {});
  });
});

// ── Graph ─────────────────────────────────────────────────────────────────────

test("buildGraph links both directions", () => {
  const g = graphOf(["REQ-001", "REQ-002"], { "REQ-002": ["REQ-001"] });
  assert.deepEqual(g.dependsOn["REQ-002"], ["REQ-001"]);
  assert.deepEqual(g.dependents["REQ-001"], ["REQ-002"]);
  assert.deepEqual(g.unknown, []);
});

test("a dependency on a requirement that does not exist is reported, not dropped", () => {
  const g = graphOf(["REQ-001"], { "REQ-001": ["REQ-999"] });
  assert.deepEqual(g.unknown, [{ requirement: "REQ-001", dependency: "REQ-999" }]);
  assert.deepEqual(g.dependsOn["REQ-001"], []);
});

test("a requirement that depends on itself is reported separately", () => {
  const g = graphOf(["REQ-001"], { "REQ-001": ["REQ-001"] });
  assert.deepEqual(g.selfReferential, ["REQ-001"]);
  assert.deepEqual(g.dependsOn["REQ-001"], []);
});

test("a declaration for a requirement outside this project is ignored", () => {
  const g = graphOf(["REQ-001"], { "REQ-500": ["REQ-001"] });
  assert.deepEqual(g.dependents["REQ-001"], []);
});

// ── Ordering ──────────────────────────────────────────────────────────────────

test("dependencies come before what needs them", () => {
  const { order } = graphOf(["REQ-003", "REQ-002", "REQ-001"], {
    "REQ-003": ["REQ-002"],
    "REQ-002": ["REQ-001"],
    "REQ-001": [],
  });
  assert.deepEqual(order, ["REQ-001", "REQ-002", "REQ-003"]);
});

test("requirements that do not constrain each other keep matrix order", () => {
  // Stability is the reason `plan` output does not churn between runs.
  const { order } = graphOf(["REQ-003", "REQ-001", "REQ-002"], {
    "REQ-001": [],
    "REQ-002": [],
    "REQ-003": [],
  });
  assert.deepEqual(order, ["REQ-003", "REQ-001", "REQ-002"]);
});

test("levels group what could run at the same time", () => {
  // This is what E1-02 will hand to a worker pool.
  const { levels } = graphOf(["REQ-001", "REQ-002", "REQ-003", "REQ-004"], {
    "REQ-001": [],
    "REQ-002": ["REQ-001"],
    "REQ-003": ["REQ-001"],
    "REQ-004": ["REQ-002", "REQ-003"],
  });
  assert.deepEqual(levels, [["REQ-001"], ["REQ-002", "REQ-003"], ["REQ-004"]]);
});

test("a cycle is named, not hung on", () => {
  const { order, cycles } = graphOf(["REQ-001", "REQ-002", "REQ-003"], {
    "REQ-001": [],
    "REQ-002": ["REQ-003"],
    "REQ-003": ["REQ-002"],
  });
  assert.deepEqual(order, ["REQ-001"], "what is orderable is still ordered");
  assert.deepEqual(cycles, [["REQ-002", "REQ-003"]]);
});

test("the same cycle reported from two entry points is one cycle", () => {
  const { cycles } = graphOf(["REQ-001", "REQ-002", "REQ-003"], {
    "REQ-001": ["REQ-002"],
    "REQ-002": ["REQ-003"],
    "REQ-003": ["REQ-001"],
  });
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0], ["REQ-001", "REQ-002", "REQ-003"]);
});

test("two independent cycles are both named", () => {
  const { cycles } = graphOf(["REQ-001", "REQ-002", "REQ-003", "REQ-004"], {
    "REQ-001": ["REQ-002"],
    "REQ-002": ["REQ-001"],
    "REQ-003": ["REQ-004"],
    "REQ-004": ["REQ-003"],
  });
  assert.equal(cycles.length, 2);
});

// ── End to end ────────────────────────────────────────────────────────────────

test("requirementGraph reads the specs and orders the matrix in one call", () => {
  withCapability(
    spec(
      requirement("REQ-001", "feature=features/a.feature"),
      requirement("REQ-002", "feature=features/b.feature depends=REQ-001")
    ),
    (dir) => {
      const g = requirementGraphFromProject(dir, ["REQ-002", "REQ-001"]);
      assert.deepEqual(g.order, ["REQ-001", "REQ-002"]);
      assert.deepEqual(g.dependsOn["REQ-002"], ["REQ-001"]);
      assert.deepEqual(g.cycles, []);
      assert.deepEqual(g.unknown, []);
    }
  );
});

test("with nothing declared, the order is the order it was given", () => {
  withCapability(spec(requirement("REQ-001"), requirement("REQ-002")), (dir) => {
    const given = ["REQ-002", "REQ-001"];
    assert.deepEqual(requirementGraphFromProject(dir, given).order, given);
  });
});

// ── plan integration ──────────────────────────────────────────────────────────

const { applyDependencies } = require("../../scripts/plan");

function item(requirement: string, category = "NEEDS_TEST") {
  return { requirement, category };
}

test("plan puts a dependency before what needs it, and marks the blocked one", () => {
  withCapability(
    spec(
      requirement("REQ-001", "feature=features/a.feature"),
      requirement("REQ-002", "feature=features/b.feature depends=REQ-001")
    ),
    (dir) => {
      const ordered = applyDependencies([item("REQ-002"), item("REQ-001")], dir);
      assert.deepEqual(
        ordered.map((it: any) => it.requirement),
        ["REQ-001", "REQ-002"]
      );
      assert.deepEqual(ordered[1].blocked_by, ["REQ-001"]);
      assert.deepEqual(ordered[0].blocked_by, []);
    }
  );
});

test("a dependency that is already DONE constrains order but blocks nothing", () => {
  withCapability(
    spec(
      requirement("REQ-001", "feature=features/a.feature"),
      requirement("REQ-002", "feature=features/b.feature depends=REQ-001")
    ),
    (dir) => {
      const ordered = applyDependencies([item("REQ-002"), item("REQ-001", "DONE")], dir);
      assert.deepEqual(ordered[1].depends_on, ["REQ-001"]);
      assert.deepEqual(ordered[1].blocked_by, [], "a finished dependency does not block");
    }
  );
});

test("a requirement inside a cycle stays in the plan rather than vanishing", () => {
  // `validate` reports the cycle. `plan` must not silently drop the work.
  withCapability(
    spec(
      requirement("REQ-001", "feature=features/a.feature depends=REQ-002"),
      requirement("REQ-002", "feature=features/b.feature depends=REQ-001")
    ),
    (dir) => {
      const ordered = applyDependencies([item("REQ-001"), item("REQ-002")], dir);
      assert.deepEqual(ordered.map((it: any) => it.requirement).sort(), ["REQ-001", "REQ-002"]);
    }
  );
});

test("with nothing declared, plan returns exactly what it was given", () => {
  // The compatibility promise: every project that never writes a `depends=`
  // sees the behaviour it saw before.
  withCapability(spec(requirement("REQ-001"), requirement("REQ-002")), (dir) => {
    const given = [item("REQ-002"), item("REQ-001")];
    const ordered = applyDependencies(given, dir);
    assert.deepEqual(
      ordered.map((it: any) => it.requirement),
      ["REQ-002", "REQ-001"]
    );
    for (const it of ordered) {
      assert.deepEqual((it as any).depends_on, []);
      assert.deepEqual((it as any).blocked_by, []);
    }
  });
});
