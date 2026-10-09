import { refreshDerivedMatrix } from "./MatrixCommand";
import { isDerivedProject } from "../../../lib/derived-writes";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { requirementGraphFromProject } from "../../../lib/requirement-graph";
import { BaseCommand } from "../../../lib/command";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { GeneratePlanUseCase } from "../../../../packages/core/src/application/GeneratePlanUseCase";
import { skippedScenarios } from "../../../../packages/core/src/domain/ScenarioCoverage";
import {
  declaredPaths,
  artifactFile,
} from "../../../../packages/core/src/domain/DeclaredArtifacts";
import { DiskRequirementGraphRepository } from "../../../../packages/core/src/infrastructure/DiskRequirementGraphRepository";
import { RequirementPlan, PlanItem } from "../../../../packages/core/src/domain/RequirementPlan";
import { requirementReadiness } from "../../../../packages/core/src/domain/RequirementReadiness";
import { analyseGherkinSource } from "../../../../packages/core/src/domain/GherkinQuality";
import { runMonorepoFanout } from "../../../lib/monorepo-fanout";

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  red: COLOR_ENABLED ? "\x1b[31m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
  yellow: COLOR_ENABLED ? "\x1b[33m" : "",
  cyan: COLOR_ENABLED ? "\x1b[36m" : "",
};

export interface PlanOptions {
  projectDir: string;
  format: string;
}

export function parseArgs(argv: string[]): PlanOptions {
  const opts: PlanOptions = { projectDir: ".", format: "text" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--format" && argv[i + 1]) opts.format = argv[++i];
    else if (a === "--json") opts.format = "json";
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        `\n  ${c.bold}${c.cyan}📋 plan${c.reset}  ${c.dim}— what still needs implementation${c.reset}\n\n` +
          `  ${c.bold}USAGE${c.reset}\n` +
          `    ${c.cyan}specgate plan${c.reset} [--project-dir <path>] [--json]\n\n`
      );
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  if (!["text", "json"].includes(opts.format)) {
    process.stderr.write(`Invalid --format: ${opts.format}. Expected: text | json.\n`);
    process.exit(2);
  }
  return opts;
}

function trimCell(v: any): string {
  return (v || "").trim();
}

export function parseTraceability(content: string): any[] {
  const rows: any[] = [];
  let mode: string | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.includes("| Requirement | Scenario ID |")) {
      mode = "rich";
      continue;
    }
    if (line.includes("| Feature | Scenario |")) {
      mode = "legacy";
      continue;
    }
    if (!mode) continue;
    const cells = line.split("|").map(trimCell);
    if (mode === "rich" && cells.length >= 12) {
      rows.push({
        mode,
        requirement: cells[1],
        scenarioId: cells[2],
        featureFile: cells[3],
        useCase: cells[4],
        command: cells[5],
        aggregate: cells[6],
        event: cells[7],
        technicalArtifact: cells[8],
        testArtifact: cells[9],
        status: cells[10],
      });
    } else if (mode === "legacy" && cells.length >= 6) {
      rows.push({
        mode,
        featureFile: cells[1],
        scenarioId: cells[2],
        technicalArtifact: cells[3],
        status: cells[4],
        requirement: null,
      });
    }
  }
  return rows;
}

export function classify(row: any, exists: any): any {
  const checker = typeof exists === "string" ? (rel: string) => fileExists(exists, rel) : exists;
  const gap = typeof exists === "string" ? (r: any) => scenarioGap(exists, r) : undefined;
  return RequirementPlan.classifyRow(row, checker, gap);
}

/**
 * A scenario in the row's feature file that no declared test names, while
 * others in the file are named — the same judgement as `validate --strict`'s
 * "Nothing proves" (`skippedScenarios`), so the plan cannot call a requirement
 * ready that the gate refuses (#54).
 */
export function scenarioGap(projectDir: string, row: any): boolean {
  const tests = declaredPaths(row.testArtifact || "").filter(
    (t) => t && t !== "-" && t.toUpperCase() !== "TBD"
  );
  const featureRel = declaredPaths(row.featureFile || "")[0];
  if (tests.length === 0 || !featureRel) return false;
  const featurePath = path.join(projectDir, artifactFile(featureRel));
  if (!fs.existsSync(featurePath) || !fs.statSync(featurePath).isFile()) return false;
  const sources = tests.flatMap((t) => {
    const full = path.join(projectDir, artifactFile(t));
    return fs.existsSync(full) && fs.statSync(full).isFile() ? [fs.readFileSync(full, "utf8")] : [];
  });
  if (sources.length === 0) return false;
  return skippedScenarios(fs.readFileSync(featurePath, "utf8"), sources).length > 0;
}

export function hintFor(item: any): string {
  switch (item.category) {
    case "NEEDS_FEATURE":
      return `Create feature file ${item.feature_file}`;
    case "NEEDS_TEST":
      return `Write test at ${item.test_artifact}`;
    case "NEEDS_IMPLEMENTATION":
      return `Implement code at ${item.technical_artifact} (create technical artifact)`;
    case "NEEDS_STATUS_UPDATE":
      return `Run \`specgate done ${item.requirement}\` to mark implemented`;
    case "NEEDS_EVERYTHING":
      return `Declare technical and test artifacts, or create ${item.feature_file}`;
    case "DONE":
      return "Complete";
    default:
      return "";
  }
}

export function fileExists(projectDir: string, rel: string): boolean {
  if (!RequirementPlan.isMeaningful(rel)) return false;
  // A generated matrix lists every file that mentions the requirement,
  // comma-separated. Checked as one path it never existed, so an Implemented
  // requirement with two test files was "NEEDS_EVERYTHING" — and the harness,
  // which picks its work from the plan, would have implemented it again.
  const paths = rel
    .replace(/`/g, "")
    .split(",")
    .map((p) => p.trim().split("#")[0])
    .filter(Boolean);
  return paths.length > 0 && paths.every((p) => fs.existsSync(path.join(projectDir, p)));
}

export function buildPlan(rows: any[], exists: any, graph?: any): any[] {
  const items: any[] = [];
  for (const r of rows) {
    const item = RequirementPlan.classifyRow(r, exists);
    if (item) {
      if (graph) {
        item.depends_on = graph.dependenciesOf(item.requirement);
        item.blocked_by = item.depends_on.filter((dep: string) => {
          const target = rows.find((other: any) => other.requirement === dep);
          return target && !RequirementPlan.DONE_STATUSES.has(target.status);
        });
      }
      items.push(item);
    }
  }
  return items;
}

export function detectOrphans(projectDir: string, items: any[]): string[] {
  const featuresDir = path.join(projectDir, "features");
  if (!fs.existsSync(featuresDir)) return [];

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name.endsWith(".feature")) out.push(full);
    }
    return out;
  };

  const declared = new Set(
    items.map((it) => (it.feature_file || "").replace(/^`|`$/g, "").trim()).filter(Boolean)
  );

  return walk(featuresDir)
    .map((full) => path.relative(projectDir, full).split(path.sep).join("/"))
    .filter((rel) => !declared.has(rel));
}

/**
 * Is this row fit to hand to an agent, and if not, why (B2)?
 *
 * The scenario check is the expensive half — it reads and parses the feature —
 * so it is skipped entirely when the file is not there, which is already a
 * blocker on its own.
 */
function readinessFor(projectDir: string, it: any) {
  const featureRel = String(it.feature_file ?? it.featureFile ?? "")
    .replace(/`/g, "")
    .split("#")[0]
    .trim();
  const featureExists = Boolean(it.feature_exists ?? it.featureExists);

  let scenarioFindings: any[] = [];
  if (featureExists && featureRel) {
    try {
      scenarioFindings = analyseGherkinSource(
        fs.readFileSync(path.join(projectDir, featureRel), "utf8"),
        featureRel
      );
    } catch {
      /* an unreadable feature is the gate's problem to report, not planning's */
    }
  }

  return requirementReadiness({
    requirement: it.requirement,
    status: it.status ?? "",
    featureFile: featureRel,
    featureExists,
    scenarioFindings,
    blockedBy: it.blocked_by ?? it.blockedBy ?? [],
    technicalDeclared: RequirementPlan.isMeaningful(it.technical_artifact ?? it.technicalArtifact),
    testDeclared: RequirementPlan.isMeaningful(it.test_artifact ?? it.testArtifact),
    derived: isDerivedProject(projectDir),
  });
}

function emitJson(items: PlanItem[], projectDir: string, orphans: string[]): void {
  const summary = items.reduce((acc: any, it) => {
    acc[it.category] = (acc[it.category] || 0) + 1;
    return acc;
  }, {});

  const actionable = items.filter(
    (it) => it.category !== "DONE" && (!it.blocked_by || it.blocked_by.length === 0)
  );

  const camelItems = items.map((it: any) => ({
    requirement: it.requirement,
    scenarioId: it.scenario_id ?? it.scenarioId ?? "",
    featureFile: it.feature_file ?? it.featureFile ?? "",
    technicalArtifact: it.technical_artifact ?? it.technicalArtifact ?? "",
    testArtifact: it.test_artifact ?? it.testArtifact ?? "",
    status: it.status ?? "",
    featureExists: Boolean(it.feature_exists ?? it.featureExists),
    technicalExists: Boolean(it.technical_exists ?? it.technicalExists),
    testExists: Boolean(it.test_exists ?? it.testExists),
    category: it.category,
    dependsOn: it.depends_on ?? it.dependsOn ?? [],
    blockedBy: it.blocked_by ?? it.blockedBy ?? [],
    // B2: whether an agent could succeed at this, and what stands in the way.
    // Every blocker carries a `fix`, because a blocker without one just stops
    // you.
    ...(() => {
      const r = readinessFor(projectDir, it);
      return { ready: r.ready, blockers: r.blockers };
    })(),
  }));

  const doc = {
    schemaVersion: 1,
    projectDir: path.resolve(projectDir),
    summary,
    total: items.length,
    actionable: actionable.length,
    next: actionable.length ? actionable[0].requirement : null,
    requirements: camelItems,
    orphanFeatures: orphans,
    status: [],
  };
  process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
}

function emitText(items: PlanItem[], orphans: string[]): void {
  const buckets: Record<string, PlanItem[]> = {
    NEEDS_EVERYTHING: [],
    NEEDS_FEATURE: [],
    NEEDS_TEST: [],
    NEEDS_IMPLEMENTATION: [],
    NEEDS_STATUS_UPDATE: [],
    DONE: [],
  };
  for (const it of items) {
    if (buckets[it.category]) buckets[it.category].push(it);
  }

  // `NEEDS_EVERYTHING` means the row declares neither code nor test — the
  // feature file is there, and `classifyRow` sends anything missing one to
  // `NEEDS_FEATURE` before it can reach here. The old label said "Needs Feature
  // + Test + Code" and the very next line printed `✓ feature:`, so the report
  // contradicted itself two lines apart. A report that does that is not read
  // twice.
  const groups: Array<[string, string, string]> = [
    ["NEEDS_EVERYTHING", "Needs Test + Code", c.red],
    ["NEEDS_FEATURE", "Needs Feature File", c.red],
    ["NEEDS_TEST", "Needs Test Artifact (TDD)", c.yellow],
    ["NEEDS_IMPLEMENTATION", "Needs Implementation", c.cyan],
    ["NEEDS_STATUS_UPDATE", "Ready to close (its declared test and code exist)", c.green],
    ["DONE", "Done", c.dim],
  ];

  for (const [key, header, color] of groups) {
    const list = buckets[key] || [];
    if (list.length === 0) continue;
    process.stdout.write(`\n  ${c.bold}${header}${c.reset}\n`);
    for (const it of list) {
      const req = it.requirement.padEnd(9);
      const scn = it.scenario_id ? ` ${c.dim}${it.scenario_id}${c.reset}` : "";
      const blocked =
        it.blocked_by && it.blocked_by.length > 0
          ? ` ${c.yellow}⛔ blocked by ${it.blocked_by.join(", ")}${c.reset}`
          : "";
      process.stdout.write(`    ${color}${req}${c.reset}${scn}${blocked}\n`);
      if (it.category === "DONE") continue;
      if (it.feature_file) {
        const mark = it.feature_exists ? "✓" : "·";
        process.stdout.write(`      ${c.dim}${mark} feature: ${it.feature_file}${c.reset}\n`);
      }
      if (RequirementPlan.isMeaningful(it.test_artifact)) {
        const mark = it.test_exists ? "✓" : "·";
        process.stdout.write(`      ${c.dim}${mark} test:    ${it.test_artifact}${c.reset}\n`);
      }
      if (RequirementPlan.isMeaningful(it.technical_artifact)) {
        const mark = it.technical_exists ? "✓" : "·";
        process.stdout.write(`      ${c.dim}${mark} code:    ${it.technical_artifact}${c.reset}\n`);
      }
    }
  }

  if (orphans && orphans.length > 0) {
    process.stdout.write(
      `\n  ${c.bold}${c.red}⚠️  Orphan feature files (on disk, not in traceability.md)${c.reset}\n`
    );
    for (const f of orphans) process.stdout.write(`    ${c.red}·${c.reset} ${f}\n`);
    process.stdout.write(
      `\n  ${c.dim}Either add a row to docs/specs/traceability.md or delete the file.${c.reset}\n`
    );
  }
}

export class PlanCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err: any) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }

    const monorepo = runMonorepoFanout(projectDir, "plan.js");
    if (monorepo !== null) {
      process.exit(monorepo.failures === 0 ? 0 : 1);
    }

    // A generated matrix is a cache: read it fresh.
    refreshDerivedMatrix(projectDir);

    const repo = new DiskTraceabilityRepository();
    const useCase = new GeneratePlanUseCase(
      repo,
      (pDir, rel) => fileExists(pDir, rel),
      new DiskRequirementGraphRepository(),
      scenarioGap
    );
    const planResult = useCase.execute(projectDir);

    if (!planResult.rawMatrix) {
      process.stderr.write(`docs/specs/traceability.md not found in ${projectDir}\n`);
      process.exit(2);
    }

    const items = planResult.items;
    const orphans = detectOrphans(projectDir, items);

    if (opts.format === "json") emitJson(items, projectDir, orphans);
    else emitText(items, orphans);

    // Return instead of `process.exit(0)`: exiting does not wait for a piped
    // stdout to drain, so a plan over 64 KB reached the harness cut at
    // exactly 65,536 bytes — "plan produced invalid JSON" (golden_app #33).
    process.exitCode = 0;
  }
}

export function applyDependencies(items: any[], projectDir: string): any[] {
  const ids = items.map((it) => it.requirement);
  const graph = requirementGraphFromProject(projectDir, ids);

  // Done means every scenario of the requirement is done.
  const isDone = (id: string) => {
    const its = items.filter((it) => it.requirement === id);
    return its.length > 0 && its.every((it) => it.category === "DONE");
  };

  for (const item of items) {
    const deps = graph.dependsOn[item.requirement] || [];
    item.depends_on = deps;
    item.blocked_by = deps.filter((dep: string) => !isDone(dep));
  }

  // A requirement with several scenarios has several items: keep all of them,
  // once each, in dependency order. Indexing by requirement kept only the
  // last one, and a repeated id in the order pushed it twice.
  const ordered: any[] = [];
  const placed = new Set<string>();
  for (const id of graph.order) {
    if (placed.has(id)) continue;
    placed.add(id);
    for (const item of items) if (item.requirement === id) ordered.push(item);
  }
  for (const item of items) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
}
