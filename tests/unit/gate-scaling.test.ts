/**
 * fast-gate: `validate --strict`, `status --json` and `matrix --json` grow
 * about linearly with the number of requirements (REQ-517).
 *
 * Before this benchmark, linking by mention scanned every test and source
 * file once per requirement and the template-obligation check split the whole
 * spec once per requirement: on generated projects `validate --strict` took
 * 1.2 s on 250 requirements and 9.9 s on 1,000 — four times the project, eight
 * times the time. The ratio is what is asserted, not a speed: a CI runner may
 * be slow, but it is slow on both sizes alike.
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import { runCli } from "../helpers/cli";
import { removeProject } from "../helpers/project";
import { syntheticProject } from "../helpers/synthetic-project";
import { deriveRows } from "../../packages/core/src/domain/DerivedMatrix";
import {
  extractRequirementSection,
  extractRequirementSections,
} from "../../packages/core/src/domain/SpecSections";

const SIZES = [500, 1000, 2000] as const;
/** Four times the requirements may take up to this many times as long: linear is ~4 minus startup. */
const MAX_RATIO = 6;
/** What one command may take on 2,000 requirements on the slowest CI runner. */
const BUDGET_MS = 120_000;

type Command = "validate" | "status" | "matrix";
const COMMANDS: Command[] = ["validate", "status", "matrix"];

function argsOf(command: Command, dir: string): string[] {
  if (command === "validate") return ["validate", dir, "--strict"];
  return [command, "--json", "--project-dir", dir];
}

/** How long one run takes, in ms; it must exit 0. */
function timed(command: Command, dir: string): number {
  const started = process.hrtime.bigint();
  const r = runCli(argsOf(command, dir));
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(r.status, 0, `${command} on ${dir}:\n${r.stdout}\n${r.stderr}`);
  return ms;
}

test("REQ-517 SCN-517a: validate --strict, status --json and matrix --json grow about linearly from 500 to 2,000 requirements", (t) => {
  const dirs = new Map<number, string>();
  try {
    for (const n of SIZES) dirs.set(n, syntheticProject(n));
    const ms = new Map<string, number>();
    const measure = (command: Command, n: number) => {
      const took = timed(command, dirs.get(n)!);
      const key = `${command}:${n}`;
      ms.set(key, Math.min(ms.get(key) ?? Infinity, took));
    };
    for (const command of COMMANDS) for (const n of SIZES) measure(command, n);

    for (const command of COMMANDS) {
      let ratio = ms.get(`${command}:2000`)! / ms.get(`${command}:500`)!;
      // One busy moment on a shared runner is not a quadratic: measure the two
      // ends again and keep the faster run of each before judging.
      if (ratio >= MAX_RATIO) {
        measure(command, 500);
        measure(command, 2000);
        ratio = ms.get(`${command}:2000`)! / ms.get(`${command}:500`)!;
      }
      t.diagnostic(
        `${command}: ${SIZES.map((n) => `${n} → ${Math.round(ms.get(`${command}:${n}`)!)} ms`).join(", ")} (×${ratio.toFixed(2)} for ×4 requirements)`
      );
      assert.ok(
        ratio < MAX_RATIO,
        `${command} took ×${ratio.toFixed(2)} as long on 2,000 requirements as on 500: something reads the project once per requirement`
      );
      assert.ok(
        ms.get(`${command}:2000`)! < BUDGET_MS,
        `${command} took ${Math.round(ms.get(`${command}:2000`)!)} ms on 2,000 requirements`
      );
    }
  } finally {
    for (const dir of dirs.values()) removeProject(dir);
  }
});

// ── The indexes keep what linking by mention matched before ─────────────────

test("REQ-517: a mention is still a whole token — after another id, before a dot, never inside a longer id", () => {
  const spec =
    "## REQ-001 — One\n\n<!-- specgate:trace status=Approved -->\n\n" +
    "## REQ-1.2 — Dotted\n\n<!-- specgate:trace status=Approved -->\n\n" +
    "## REQ-002 — Two\n\n<!-- specgate:trace status=Approved -->\n";
  const rows = deriveRows({
    spec,
    features: [],
    tests: [
      { path: "t/a.test.js", source: "// SCN-REQ-001 names REQ-001 after a dash" },
      { path: "t/b.test.js", source: "// REQ-0021 is a longer id" },
      { path: "t/c.test.js", source: "// REQ-1.2 and REQ-002.5" },
      { path: "t/d.test.js", source: "// xREQ-001 is not a mention" },
    ],
    code: [{ path: "src/one.js", source: "/* REQ-001 */" }],
  });
  const of = (id: string) => rows.find((r) => r.requirement === id);
  assert.equal(of("REQ-001")?.testArtifact, "t/a.test.js");
  assert.equal(of("REQ-001")?.technicalArtifact, "`src/one.js`");
  assert.equal(of("REQ-1.2")?.testArtifact, "t/c.test.js");
  assert.equal(of("REQ-002")?.testArtifact, "t/c.test.js");
});

test("REQ-517: several sections read at once are the sections read one by one", () => {
  const spec = [
    "# Spec",
    "| ID | Requirement |",
    "|---|---|",
    "| REQ-009 | Kept in a table |",
    "| REQ-010 | TBD |",
    "## REQ-001 — One",
    "The system SHALL one.",
    "#### Scenario: SCN-001 — names REQ-002",
    "### REQ-002 — Two, nested",
    "The system SHALL two.",
    "## REQ-003 — Three",
    "##### deep",
    "text",
  ].join("\r\n");
  const ids = ["REQ-001", "REQ-002", "REQ-003", "REQ-009", "REQ-010", "REQ-404"];
  const all = extractRequirementSections(spec, ids);
  for (const id of ids) assert.equal(all.get(id), extractRequirementSection(spec, id), id);
  assert.match(all.get("REQ-001") || "", /Two, nested/);
  assert.equal(all.get("REQ-009"), "## REQ-009\n\nKept in a table");
  assert.equal(all.get("REQ-010"), null);
  assert.match(all.get("REQ-003") || "", /##### deep\ntext$/);
});
