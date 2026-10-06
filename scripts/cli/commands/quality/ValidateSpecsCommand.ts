import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../../../packages/core/src/domain/YamlLite";
import { listChangeIds } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { ValidateChangeUseCase } from "../../../../packages/core/src/application/ValidateChangeUseCase";
import { DiskProjectRepository } from "../../../../packages/core/src/infrastructure/DiskProjectRepository";
import { formatDiagnostic, error, warning } from "../../../lib/diagnostics";
import { checkAgainstLock } from "../../../specops/against_lock";
import { requirementGraphFromProject } from "../../../lib/requirement-graph";
import { SHARED_PATHS } from "../../../../packages/core/src/domain/MultiStack";
import {
  skippedScenarios,
  linkIsUnevidenced,
  usesNamingConvention,
} from "../../../../packages/core/src/domain/ScenarioCoverage";
import {
  countDraftExempt,
  DELIVERED_STATUS,
} from "../../../../packages/core/src/domain/TraceabilityFormat";
import * as crypto from "node:crypto";
import { agentIo, wantsJson, EXIT } from "../../../lib/agent";
import { findUnresolvedPlaceholders } from "../../../lib/placeholders";
import { BaseCommand } from "../../../lib/command";
import { ValidateProjectUseCase } from "../../../../packages/core/src/application/ValidateProjectUseCase";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { RICH_HEADER } from "../../../../packages/core/src/domain/TraceabilityFormat";
import { findCliRoot } from "../../../lib/project-root";
import {
  analyseGherkinSource,
  QUALITY_CODES,
} from "../../../../packages/core/src/domain/GherkinQuality";

/** Scenario findings that make a suite report a pass it did not run. */
const SUITE_LIES = new Set<string>([
  QUALITY_CODES.NO_STEPS,
  QUALITY_CODES.KEYWORD_CASE,
  QUALITY_CODES.OUTLINE_WITHOUT_EXAMPLES,
]);
import { csdaTagsIn } from "../../../../packages/core/src/domain/GherkinTags";
import { parseTraceabilityRows } from "../../../../packages/core/src/domain/TraceabilityFormat";
import { analyseRequirementText } from "../../../../packages/core/src/domain/RequirementSyntax";
import {
  declaredPaths,
  artifactFile,
} from "../../../../packages/core/src/domain/DeclaredArtifacts";
import {
  parseSpec,
  blockText,
  requirementKey,
} from "../../../../packages/core/src/domain/SpecParser";
import { CAPABILITIES_DIR } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";

export class ValidateSpecsCommand extends BaseCommand {
  private io: any = null;

  private logInfo(msg: string) {
    const stream = this.io && this.io.json ? process.stderr : process.stdout;
    stream.write(`ℹ️ [INFO] ${msg}\n`);
  }
  private logError(msg: string) {
    process.stderr.write(`❌ [ERROR] ${msg}\n`);
  }

  private usage() {
    process.stdout.write(
      "🔎 Usage:\n" +
        "  specgate validate <project_dir> [--strict] [--strict-tdd] [--strict-scenarios] " +
        "  [--strict-coverage] " +
        "[--strict-requirements] [--strict-links] [--against-lock]\n\n" +
        "Checks:\n" +
        "- minimum SDD structure\n" +
        "- required files\n" +
        "- at least one .feature file\n" +
        "- unresolved placeholders ({{...}})\n" +
        "- feature coverage in traceability.md\n" +
        "- allowed status values in traceability.md\n" +
        "- expected DDD Lite document headers when present\n\n" +
        "--against-lock additionally enforces:\n" +
        "- Every requirement the locked packs declare is present in the matrix\n" +
        "- Its scenario and feature file still match what the pack declares\n\n" +
        "--strict-scenarios additionally enforces, over features/**/*.feature:\n" +
        "- No scenario Cucumber would see as empty (upper-case keywords are the usual cause)\n" +
        "- Every scenario has a When and a Then, at least three steps and a title that names the behaviour\n" +
        "- No vague, unfalsifiable step text; no Scenario Outline without Examples\n\n" +
        "--strict-tdd additionally enforces:\n" +
        "- No 'Test Artifact = TBD' when Status is In Dev or later\n" +
        "- Every requirement has at least one traceability row\n" +
        "- Every scenario row has a non-empty Scenario ID\n\n" +
        "--strict-requirements additionally enforces, over docs/specs/capabilities/**/spec.md:\n" +
        "- Every requirement states an obligation (SHALL / MUST / SHOULD / MAY / DEBE / DEBERÁ)\n" +
        "- A requirement that opens with IF resolves with THEN in the same sentence\n\n" +
        "--strict is the gate: every check below, in one flag. Prefer it — the\n" +
        "individual flags exist so an existing CI invocation keeps meaning what it meant.\n\n" +
        "--strict-coverage additionally enforces:\n" +
        "- Every scenario in a declared feature file is named by the test artifact that\n" +
        "  claims to prove it\n" +
        "- Every declared test artifact names its requirement or one of its scenarios —\n" +
        "  a path that exists is not evidence that it proves anything\n" +
        "  Both are name matches, so this is opt-in: it does not run your suite\n\n" +
        "--strict-links additionally enforces:\n" +
        "- Every Feature file / Technical artifact / Test artifact the matrix declares as a\n" +
        "  path still exists on disk\n"
    );
  }

  private logFix(lines: string | string[]) {
    for (const line of Array.isArray(lines) ? lines : [lines]) {
      process.stderr.write(`💡 [FIX] ${line}\n`);
    }
  }

  private logWarn(msg: string) {
    const stream = this.io && this.io.json ? process.stderr : process.stdout;
    stream.write(`⚠️ [WARN] ${msg}\n`);
  }

  /**
   * True when the only Gherkin in the project is the placeholder `adopt` writes.
   *
   * `adopt` installs a skeleton and a baseline scenario so that `validate` passes
   * on day one — deliberately, because a gate that rejects a fresh adoption is a
   * gate nobody installs. The cost is that a project which never retro-filled a
   * single requirement is indistinguishable from a healthy one at the only place
   * most people look: the CI gate. Seen on `lixi-platform`, adopted months ago,
   * still one placeholder requirement against 297 real tests (H15).
   *
   * So: still a pass, never an error — but it says so.
   */
  private isAdoptionSkeletonOnly(targetDir: string, featureFiles: string[]) {
    if (featureFiles.length !== 1) return false;
    const rel = path.relative(targetDir, featureFiles[0]).split(path.sep).join("/");
    return rel === "features/adoption/baseline.feature";
  }

  private fail(code: string, msg: string, exitCode = 1, fix: string | string[] | null = null) {
    const fixLines = fix ? (Array.isArray(fix) ? fix : [fix]) : [];
    if (this.io && this.io.json) {
      const diag = error(code, msg, fixLines.length ? { fix: fixLines.join(" ") } : undefined);
      if (exitCode === EXIT.USAGE) this.io.usage({ validation: null }, [diag]);
      this.io.fail({ validation: null }, [diag]);
      return;
    }
    this.logError(msg);
    if (fixLines.length) this.logFix(fixLines);
    process.exit(exitCode);
  }

  /**
   * A shared spec that is only shared by convention is not shared.
   *
   * `init --multi-stack` symlinks spec.md, features/ and the ADR index into
   * every stack, so there is one file with several names. Windows refuses to
   * create symlinks without Developer Mode, and scaffolding copies instead —
   * at which point "shared" is a claim rather than a fact, and the three stacks
   * can quietly start describing different products.
   *
   * So the guarantee moves into the gate: a copy that no longer matches the
   * root is an error. Symlinked trees skip this, because they cannot drift.
   */
  private sharedSpecDrift(rootDir: string, projectRel: string): string[] {
    const digest = (target: string): string => {
      const h = crypto.createHash("sha256");
      const stat = fs.statSync(target);
      if (stat.isFile()) {
        h.update(fs.readFileSync(target));
        return h.digest("hex");
      }
      const entries: string[] = [];
      const walkInto = (dir: string) => {
        for (const name of fs.readdirSync(dir).sort()) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) walkInto(full);
          else entries.push(path.relative(target, full).split(path.sep).join("/"));
        }
      };
      walkInto(target);
      for (const rel of entries) {
        h.update(rel);
        h.update(fs.readFileSync(path.join(target, rel)));
      }
      return h.digest("hex");
    };

    const drifted: string[] = [];
    for (const shared of SHARED_PATHS) {
      const atRoot = path.join(rootDir, shared);
      const inProject = path.join(projectRel, shared);
      if (!fs.existsSync(atRoot) || !fs.existsSync(inProject)) continue;
      // A link cannot drift from what it points at.
      const link = fs.lstatSync(inProject, { throwIfNoEntry: false });
      if (link && link.isSymbolicLink()) continue;
      try {
        if (digest(atRoot) !== digest(inProject)) drifted.push(shared);
      } catch {
        // Unreadable is a different problem, and the normal checks report it.
      }
    }
    return drifted;
  }

  private validateMonorepo(
    targetDir: string,
    strictTdd: boolean,
    strictScenarios: boolean,
    strictRequirements: boolean,
    strictLinks: boolean,
    strictCoverage: boolean
  ) {
    const cfgPath = path.join(targetDir, "specops.config.yaml");
    if (!fs.existsSync(cfgPath)) return null;
    let cfg: any;
    try {
      cfg = parseYamlLite(fs.readFileSync(cfgPath, "utf8"));
    } catch {
      return null;
    }
    const projects = cfg && Array.isArray(cfg.projects) ? cfg.projects : null;
    if (!projects || projects.length === 0) return null;

    this.logInfo(`🗂️ Monorepo: validating ${projects.length} project(s) from specops.config.yaml`);
    const results = [];
    for (const entry of projects) {
      const rel = typeof entry === "string" ? entry : entry && entry.path;
      if (!rel) {
        results.push({ project: String(entry), ok: false, detail: "invalid projects entry" });
        continue;
      }
      const subDir = path.join(targetDir, rel);
      process.stdout.write(`\n── ${rel} ──\n`);
      if (!fs.existsSync(subDir)) {
        this.logError(`Project directory not found: ${rel}`);
        this.logFix(`Fix the 'projects:' entry in specops.config.yaml or create ${rel}.`);
        results.push({ project: rel, ok: false, detail: "directory not found" });
        continue;
      }
      const root = findCliRoot(__dirname);
      const scriptPath = fs.existsSync(path.join(root, "dist", "scripts", "validate_specs.js"))
        ? path.join(root, "dist", "scripts", "validate_specs.js")
        : path.join(root, "scripts", "validate_specs.js");
      const args = [scriptPath, subDir];
      if (strictTdd) args.push("--strict-tdd");
      if (strictScenarios) args.push("--strict-scenarios");
      if (strictRequirements) args.push("--strict-requirements");
      if (strictLinks) args.push("--strict-links");
      if (strictCoverage) args.push("--strict-coverage");
      const r = spawnSync(process.execPath, args, { encoding: "utf8" });
      process.stdout.write(r.stdout || "");
      process.stderr.write(r.stderr || "");

      const drifted = this.sharedSpecDrift(targetDir, subDir);
      if (drifted.length > 0) {
        this.logError(
          `Shared spec has drifted in ${rel}: ${drifted.join(", ")} no longer matches the root`
        );
        this.logFix([
          "These paths are meant to be one artifact for the whole tree. They were copied",
          "rather than symlinked (this platform would not create links), so an edit in one",
          "stack does not reach the others.",
          `Fix: copy the root's version over ${rel}'s, or move the edit to the root and`,
          "copy outward — then commit both.",
        ]);
        results.push({ project: rel, ok: false, detail: "shared spec drift" });
        continue;
      }

      results.push({ project: rel, ok: r.status === 0 });
    }

    const failures = results.filter((r) => !r.ok);
    process.stdout.write("\n── monorepo summary ──\n");
    for (const r of results) {
      process.stdout.write(
        `  ${r.ok ? "✅" : "❌"} ${r.project}${r.detail ? ` (${r.detail})` : ""}\n`
      );
    }
    process.stdout.write(
      `\n${failures.length === 0 ? "✅" : "❌"} ${results.length - failures.length}/${results.length} project(s) passed\n`
    );
    return { failures: failures.length };
  }

  /**
   * `--strict-scenarios`: the pack's quality rules, applied where the harness
   * actually runs (A3).
   *
   * `docs/specs/harness.md` says the gate is only as strong as its scenarios,
   * and until now the rules that enforce that lived in `pack lint` and judged
   * one thing: a `pack.yaml`. But a project's features arrive by three routes
   * that never touch `pack lint` — `change archive`, `req add`, and a person
   * with an editor. This closes that gap by reading the same domain rules.
   *
   * **Why a flag and not the default.** A project brought in with `specgate adopt`
   * can have dozens of weak features written long before this tool existed;
   * failing its first `validate` would teach people to skip the gate. `specgate
   * doctor` reports the same findings as advisories, which is the gradual path
   * this tool uses everywhere else. Under the flag, warnings fail too — asking
   * for strict and getting lenient is the H14 mistake in a different costume.
   */
  private checkScenarioQuality(targetDir: string, featureFiles: string[], delivering = "") {
    const owed = this.featureFilesOwed(targetDir, delivering);
    const findings = [];
    for (const file of featureFiles.slice().sort()) {
      const rel = path.relative(targetDir, file).split(path.sep).join("/");
      const found = analyseGherkinSource(fs.readFileSync(file, "utf8"), rel);
      // A scenario Cucumber reports as passing without running anything lies
      // whatever the row's status (H14). The rest is owed on delivery.
      findings.push(...(owed(rel) ? found : found.filter((d) => SUITE_LIES.has(d.code))));
    }
    if (findings.length === 0) return;

    if (this.io.json) {
      this.io.fail({ validation: null }, findings);
      return;
    }
    const errs = findings.filter((f) => f.severity === "error");
    this.logError(
      `--strict-scenarios violations detected: ${findings.length} ` +
        `(${errs.length} that make a scenario pass without testing anything)`
    );
    for (const f of findings) process.stderr.write(`  ${formatDiagnostic(f)}\n`);
    this.logFix([
      "Fix the errors first: a scenario Cucumber sees as empty reports `0 steps · exit 0`,",
      "so the gate approves the requirement without having checked it.",
    ]);
    process.exit(1);
  }

  /**
   * Which feature files the scenario rules apply to: the same line as
   * `--strict-links` — a Draft row owes nothing yet, a delivered one owes
   * everything. `specgate new` writes a scenario of `<placeholder>` steps for a
   * person to fill in; failing the build the moment it exists would teach
   * people to skip the gate, and passing it once delivered would be a green
   * that means nothing. A file no row claims is always checked.
   */
  private featureFilesOwed(targetDir: string, delivering: string): (rel: string) => boolean {
    const tracePath = path.join(targetDir, "docs/specs/traceability.md");
    if (!fs.existsSync(tracePath)) return () => true;
    let rows: any[] = [];
    try {
      rows = parseTraceabilityRows(fs.readFileSync(tracePath, "utf8")).rows || [];
    } catch {
      return () => true;
    }
    const claimed = new Set<string>();
    const owed = new Set<string>();
    for (const row of rows) {
      const delivered =
        DELIVERED_STATUS.has(String(row.status || "").trim()) ||
        (delivering !== "" && row.requirement === delivering);
      for (const declared of declaredPaths(row.featureFile)) {
        const rel = artifactFile(declared);
        if (!rel) continue;
        claimed.add(rel);
        if (delivered) owed.add(rel);
      }
    }
    return (rel) => owed.has(rel) || !claimed.has(rel);
  }

  /**
   * Does the scenario the matrix names actually exist in the file? (F4)
   *
   * The help text has been asking for a Scenario ID "that matches a scenario in
   * its feature file" without ever comparing the two. Measured before writing
   * this: rename the scenario and both `--strict-tdd` and `--strict-scenarios`
   * still pass, with the matrix pointing at something that is not there.
   *
   * The check runs off tags, because a tag survives the rename and a title does
   * not — and the matrix carries an id, not a title, so there is nothing else to
   * compare. `specgate expand` writes them; nobody types them.
   *
   * **Only files that carry our tags are checked.** A project brought in with
   * `specgate adopt`, or one scaffolded before this existed, has none — and failing
   * it here would punish it for a link it was never given the means to make.
   * Once a file is tagged, a row pointing into it has to be right.
   */
  private checkScenarioTags(targetDir: string, traceContent: string) {
    let rows: any[] = [];
    try {
      rows = parseTraceabilityRows(traceContent).rows || [];
    } catch {
      return;
    }

    for (const row of rows) {
      const scenarioId = String(row.scenarioId || "").trim();
      const featureRel = String(row.featureFile || "")
        .replace(/`/g, "")
        .split("#")[0]
        .trim();
      if (!/^SCN-[A-Za-z0-9.]+$/.test(scenarioId) || !featureRel) continue;

      const file = path.join(targetDir, featureRel);
      if (!fs.existsSync(file)) continue; // the coverage check below reports this

      let tags: string[] = [];
      try {
        tags = csdaTagsIn(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      if (tags.length === 0) continue; // untagged file — nothing to compare against

      if (!tags.includes(`@${scenarioId}`)) {
        this.fail(
          "scenario_id_not_in_feature",
          `${featureRel} carries traceability tags but not @${scenarioId}, which ` +
            `${row.requirement || "a row"} declares. The matrix points at a scenario ` +
            `that is not there.`,
          1,
          [
            `Tag the scenario: put \`@${scenarioId}\` above its \`Scenario:\` line,`,
            "or correct the Scenario ID in docs/specs/traceability.md.",
          ]
        );
      }
    }
  }

  /**
   * Does a declared link still point at something that exists? (F6 follow-on,
   * `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.5)
   *
   * The plan names the first honest check beyond paperwork: not formal
   * verification, just the matrix's own promises kept — a file gets renamed
   * or deleted and the row that names it is never updated, so the matrix
   * points a reader (or an agent) at code that is not there.
   *
   * **`--strict-links`, not unconditional — measured, not assumed.** The
   * first version of this check ran by default on the theory that "this path
   * does not exist" has no legitimate reading. `tests/unit/validate-strict-
   * tdd.test.ts` disproved that immediately: a `Draft` or `In Dev` row
   * routinely names the file a requirement is *going to* land in before
   * anyone writes it — planning ahead, not documentary drift. That is exactly
   * the shape `DeclaredArtifacts`' own `declared_artifact_untouched` already
   * treats as a warning, not a certainty, and the same reasoning applies here.
   * Opt-in, same promise as `--strict-scenarios`: a project with aspirational
   * rows does not fail its next `validate` over this.
   */
  private checkDeclaredArtifactsExist(targetDir: string, traceContent: string, delivering = "") {
    let rows: any[] = [];
    try {
      rows = parseTraceabilityRows(traceContent).rows || [];
    } catch {
      return;
    }

    const findings: any[] = [];
    const seen = new Set<string>();
    const columns: Array<[string, string]> = [
      ["feature file", "featureFile"],
      ["technical artifact", "technicalArtifact"],
      ["test artifact", "testArtifact"],
    ];

    for (const row of rows) {
      // A row that has not been delivered names where the work is going to
      // land; only a delivered one claims the file is there. Measured
      // 2026-10-06: with `--strict` as the CI gate, every planned row failed
      // the build — and in the harness, one pending requirement's paths failed
      // its sibling's worktree.
      const owesFiles =
        DELIVERED_STATUS.has(String(row.status || "").trim()) ||
        (delivering !== "" && row.requirement === delivering);
      if (!owesFiles) continue;
      for (const [label, key] of columns) {
        for (const declared of declaredPaths(row[key])) {
          // A cell may point into a file — an anchor (`login.ts#L15-L89`) or a
          // test selector (`test_x.py::test_y`). Neither is part of the filename.
          const rel = artifactFile(declared);
          if (!rel || seen.has(`${row.requirement || row.feature}::${rel}`)) continue;
          if (fs.existsSync(path.join(targetDir, rel))) continue;
          seen.add(`${row.requirement || row.feature}::${rel}`);
          findings.push(
            error(
              "declared_artifact_missing",
              `${row.requirement || row.feature || "a row"}'s ${label} \`${rel}\` does not exist.`,
              {
                target: row.requirement || row.feature,
                file: "docs/specs/traceability.md",
                fix: `Fix the path, or restore ${rel} if it was removed by mistake.`,
              }
            )
          );
        }
      }
    }
    if (findings.length === 0) return;

    if (this.io.json) {
      this.io.fail({ validation: null }, findings);
      return;
    }
    this.logError(`Declared artifacts that no longer exist: ${findings.length}`);
    for (const f of findings) process.stderr.write(`  ${formatDiagnostic(f)}\n`);
    this.logFix([
      "The matrix is pointing at a file that is not there — fix the path,",
      "or restore the file if it was removed by mistake.",
    ]);
    process.exit(1);
  }

  /**
   * `--strict-coverage`: every declared scenario is named by something that
   * claims to prove it (#168).
   *
   * A row names one `Scenario ID` and one feature file; the file may hold five
   * scenarios, and nothing related the other four to anything. Measured: a
   * feature declaring three scenarios with tests covering two passed
   * `--strict-tdd --strict-scenarios --strict-links` all at once, with the row
   * on `Implemented`.
   *
   * It is behind its own flag on purpose. The check is a name match — this tool
   * does not run the suite and cannot know which assertion belongs to which
   * scenario — and a project that names its tests some other way would fail
   * through no fault of its own. Opting in is the honest interface for a
   * heuristic.
   */
  private checkScenarioCoverage(targetDir: string, traceContent: string) {
    let rows: any[] = [];
    try {
      rows = parseTraceabilityRows(traceContent).rows || [];
    } catch {
      return;
    }

    const readAll = (rel: string): string[] => {
      const full = path.join(targetDir, artifactFile(rel));
      if (!fs.existsSync(full)) return [];
      const stat = fs.statSync(full);
      if (stat.isFile()) return [fs.readFileSync(full, "utf8")];
      const out: string[] = [];
      const walkTests = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          const child = path.join(dir, name);
          if (fs.statSync(child).isDirectory()) walkTests(child);
          else out.push(fs.readFileSync(child, "utf8"));
        }
      };
      walkTests(full);
      return out;
    };

    const findings: any[] = [];
    const advisories: any[] = [];
    const seen = new Set<string>();

    // Read every row once first, so the check can calibrate before it judges.
    const readRow = (row: any) => {
      const declaredTests = declaredPaths(row.testArtifact).filter(
        (t: string) => t && t !== "-" && t.toUpperCase() !== "TBD"
      );
      const featureRel = declaredPaths(row.featureFile)[0];
      const featurePath = featureRel ? path.join(targetDir, artifactFile(featureRel)) : null;
      return {
        requirement: row.requirement || "",
        featureRel,
        feature:
          featurePath && fs.existsSync(featurePath) ? fs.readFileSync(featurePath, "utf8") : "",
        tests: declaredTests.flatMap(readAll),
        declaredTests,
      };
    };

    const read = rows.map(readRow).filter((r) => r.declaredTests.length > 0);

    // Does this project name requirements in its tests at all? A brownfield
    // adoption points rows at tests written years before this tool existed, and
    // the only way to satisfy a name match there is to edit them — which is the
    // one thing `adopt` promises it will never make you do.
    const conventionInUse = read.length > 0 && usesNamingConvention(read);

    if (read.length > 0 && !conventionInUse) {
      this.logWarn(
        "--strict-coverage could not run: no test artifact in this project names its " +
          "requirement or any of its scenarios."
      );
      this.logFix([
        "This check matches names, and nothing here uses that convention — which is normal",
        "for a repository whose tests predate its specifications. It is not a finding:",
        "failing every row for a convention nobody adopted would be the gate lying.",
        "",
        "To turn it on, name the requirement in the test that proves it — a comment or a",
        "test name mentioning REQ-NNN is enough — and this check starts holding the rest",
        "of the matrix to the same standard.",
      ]);
      return;
    }

    for (const row of rows) {
      // A `TBD` or `-` test artifact is --strict-tdd's finding, not this one:
      // reporting it twice under two flags helps nobody.
      const declaredTests = declaredPaths(row.testArtifact).filter(
        (t) => t && t !== "-" && t.toUpperCase() !== "TBD"
      );
      if (declaredTests.length === 0) continue;

      const sources = declaredTests.flatMap(readAll);
      const featureRel = declaredPaths(row.featureFile)[0];
      const featurePath = featureRel ? path.join(targetDir, artifactFile(featureRel)) : null;
      const feature =
        featurePath && fs.existsSync(featurePath) ? fs.readFileSync(featurePath, "utf8") : "";

      // A row with no scenario has nothing for the per-scenario check to match
      // on — and those are the rows that lie most easily, because `adopt` seeds
      // them with a use case and no scenario. Measured on a real adoption: a
      // "Vet" requirement declared `PetValidatorTests.java` as its proof and
      // every gate stayed green. The requirement id is the only evidence left.
      const requirementId = row.requirement || "";
      // Advisory, not a failure. At row level this cannot tell "the team has
      // not adopted the convention yet" from "this link is a lie", and failing
      // the first to catch the second is what made adding one comment turn
      // three unrelated rows red.
      if (linkIsUnevidenced(requirementId, feature, sources)) {
        const key = `${requirementId}::unevidenced`;
        if (!seen.has(key)) {
          seen.add(key);
          advisories.push(
            warning(
              "link_without_evidence",
              `${requirementId}'s test artifact names neither ${requirementId} nor any of ` +
                `its scenarios.`,
              {
                target: requirementId,
                file: "docs/specs/traceability.md",
                fix:
                  `Name ${requirementId} or one of its scenarios in ` +
                  `${declaredTests.join(" or ")}, or point the row at the test that ` +
                  `really proves it. A path that exists is not evidence that it proves ` +
                  `anything.`,
              }
            )
          );
        }
        continue;
      }

      if (!featurePath || !fs.existsSync(featurePath)) continue; // --strict-links reports this.

      for (const scenario of skippedScenarios(feature, sources)) {
        const key = `${featureRel}::${scenario.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push(
          error("scenario_not_covered", `Nothing proves "${scenario.title}" (${featureRel}).`, {
            target: row.requirement || row.feature,
            file: featureRel,
            fix:
              `Add a test naming ${scenario.needles[0]} to ` +
              `${declaredTests.join(" or ")}, or delete the scenario if it no ` +
              `longer describes behaviour this project promises.`,
          })
        );
      }
    }
    // Formatted like the errors, so an advisory carries its code and can be
    // grepped for in CI output the same way.
    for (const a of advisories) {
      process.stderr.write(`  ${formatDiagnostic(a)}\n`);
    }

    if (findings.length === 0) return;

    if (this.io.json) {
      this.io.fail({ validation: null }, [...findings, ...advisories]);
      return;
    }
    this.logError(`Declared scenarios nothing proves: ${findings.length}`);
    for (const f of findings) process.stderr.write(`  ${formatDiagnostic(f)}\n`);
    // Each finding already carries its own fix; this is the shared why. It used
    // to say "a scenario no test names" for both codes, which was the wrong
    // advice for half of them.
    this.logFix([
      "A promise with nothing behind it is the thing this gate exists to catch —",
      "and it is what an agent leaves behind when it cannot satisfy a scenario.",
      "Other rows in this project do name what proves them, so these stand out.",
    ]);
    process.exit(1);
  }

  /**
   * `--strict-requirements`: EARS-checkable requirement prose, at rest (F6).
   *
   * `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.1 names the prerequisite for any
   * code-level verifier: the spec has to say something a machine can check.
   * `DeltaSpec` already enforces an obligation keyword (`no_rfc2119_keyword`),
   * but only inside a delta — a capability spec at rest, `docs/specs/
   * capabilities/<cap>/spec.md`, has never been checked. This reads every one
   * of those, the only `spec.md` grammar in the project with a real parser
   * (§8.3), and applies the same rule plus the one EARS shape a regex can
   * check honestly.
   *
   * **Opt-in, same reasoning as `--strict-scenarios`.** A project's capability
   * specs may predate this check; failing the default `validate` on them would
   * teach people to skip the gate rather than fix the prose.
   *
   * **A project with no `docs/specs/capabilities/` is not a failure.** Most
   * scaffolded projects never grow one — it is the change-lifecycle structure,
   * not something `specgate init` writes. Nothing to check is not a violation.
   */
  /**
   * The root `spec.md` plus every capability spec, concatenated.
   *
   * Concatenation is enough because the only question asked of it is "does this
   * requirement have text somewhere". Nothing downstream cares which file the
   * text came from.
   */
  private collectSpecProse(targetDir: string, specPath: string): string | null {
    const parts: string[] = [];
    if (fs.existsSync(specPath)) parts.push(fs.readFileSync(specPath, "utf8"));

    const capabilitiesDir = path.join(targetDir, CAPABILITIES_DIR);
    if (fs.existsSync(capabilitiesDir)) {
      for (const entry of fs.readdirSync(capabilitiesDir, { withFileTypes: true }).sort()) {
        if (!entry.isDirectory()) continue;
        const capSpec = path.join(capabilitiesDir, entry.name, "spec.md");
        if (fs.existsSync(capSpec)) parts.push(fs.readFileSync(capSpec, "utf8"));
      }
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  private checkRequirementSyntax(targetDir: string) {
    const capabilitiesDir = path.join(targetDir, CAPABILITIES_DIR);
    if (!fs.existsSync(capabilitiesDir)) return;

    const findings = [];
    for (const entry of fs
      .readdirSync(capabilitiesDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const specPath = path.join(capabilitiesDir, entry.name, "spec.md");
      if (!fs.existsSync(specPath)) continue;
      const rel = path.relative(targetDir, specPath).split(path.sep).join("/");
      const spec = parseSpec(fs.readFileSync(specPath, "utf8"));
      for (const req of spec.requirements) {
        const text = blockText(req.text);
        if (!text.trim()) continue;
        findings.push(
          ...analyseRequirementText(text, {
            target: req.id || requirementKey(req) || req.name,
            file: rel,
            line: req.line,
          })
        );
      }
    }
    if (findings.length === 0) return;

    if (this.io.json) {
      this.io.fail({ validation: null }, findings);
      return;
    }
    this.logError(`--strict-requirements violations detected: ${findings.length}`);
    for (const f of findings) process.stderr.write(`  ${formatDiagnostic(f)}\n`);
    this.logFix([
      "State an obligation (SHALL / MUST / SHOULD / MAY, or DEBE / DEBERÁ), and if the",
      "requirement opens with IF, resolve it with THEN in the same sentence.",
    ]);
    process.exit(1);
  }

  public execute(): void {
    const rawArgs = this.args[0] === "validate" ? this.args.slice(1) : this.args;
    const argv = rawArgs;
    this.io = agentIo(wantsJson(argv));
    // `--strict` is the gate, singular.
    //
    // A cold evaluator counted ten places calling `--strict-tdd` "the gate" —
    // the quickstart, `adopt`'s epilogue, the generated AI_RULES.md, `harness
    // init`, the harness prompt — while `ci init` alone emitted
    // `--strict-tdd --strict-links`. So a user who followed any of the ten got
    // a check that passes on an Implemented requirement whose test file does
    // not exist, and the one place that was right made the other nine look
    // like a mistake rather than a policy.
    //
    // Fixing the wording in ten places would have left the same trap for the
    // eleventh. One name that means all of them is the fix; the individual
    // flags keep working, so every existing CI invocation still means what it
    // meant.
    const strict = argv.includes("--strict");
    const strictTdd = strict || argv.includes("--strict-tdd");
    const strictScenarios = strict || argv.includes("--strict-scenarios");
    const strictRequirements = strict || argv.includes("--strict-requirements");
    const strictLinks = strict || argv.includes("--strict-links");
    const strictCoverage = strict || argv.includes("--strict-coverage");
    const againstLock = argv.includes("--against-lock");
    // `--delivering REQ-NNN` holds one requirement to what a delivered row
    // owes while its Status still says Draft. `done --check` and the harness
    // gate run before the status flips, so without it they would skip the very
    // requirement they are about to mark Implemented.
    const deliveringAt = argv.indexOf("--delivering");
    const delivering = deliveringAt >= 0 ? argv[deliveringAt + 1] || "" : "";
    const positional = argv.filter(
      (a, i) => !a.startsWith("-") && !(deliveringAt >= 0 && i === deliveringAt + 1)
    );

    // Asking what a command does is not a usage error, and it exits 0.
    if (argv.includes("--help") || argv.includes("-h")) {
      this.usage();
      process.exit(0);
    }

    const targetDir = positional[0];
    if (!targetDir) {
      this.usage();
      process.exit(2);
    }
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      this.fail("project_dir_not_found", `Directory not found: ${targetDir}`, EXIT.USAGE, [
        "Check the path for typos, or scaffold a new project first:",
        "  specgate init",
      ]);
    }

    const monorepo = this.validateMonorepo(
      targetDir,
      strictTdd,
      strictScenarios,
      strictRequirements,
      strictLinks,
      strictCoverage
    );
    if (monorepo !== null) {
      process.exit(monorepo.failures === 0 ? 0 : 1);
    }

    const SKIP_DIRS = new Set([
      "node_modules",
      "dist",
      "build",
      "out",
      "target",
      "coverage",
      "vendor",
      ".git",
      ".next",
      ".gradle",
      ".specops",
    ]);

    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
      }
      return out;
    }

    function findRecursive(rootDir: string, predicate: (f: string) => boolean) {
      return walk(rootDir).filter(predicate);
    }

    const REQUIRED_FILES = [
      "spec.md",
      "AI_RULES.md",
      "README.md",
      "docs/specs/traceability.md",
      "docs/specs/adr/README.md",
    ];
    const REQUIRED_DIRS = ["features", "docs/specs"];
    const PLACEHOLDER_RE = /\{\{[A-Z_][A-Z0-9_]*\}\}/;

    for (const d of REQUIRED_DIRS) {
      if (!fs.existsSync(path.join(targetDir, d))) {
        this.fail("missing_required_dir", `Missing required directory: ${d}`, 1, [
          `Create it: mkdir -p ${d}`,
          "Or scaffold the full SDD structure with `specgate init` / `specops add`.",
        ]);
      }
    }

    const FILE_FIXES: Record<string, string> = {
      "spec.md":
        "Author it from the shipped template (templates/base/spec.md.tpl) — one `## REQ-NNN — <title>` section per requirement.",
      "AI_RULES.md":
        "Author it from templates/backend/AI_RULES.md.tpl (or frontend) — it is the agent's project rulebook.",
      "README.md": "Add a README.md describing how to build and test the project.",
      "docs/specs/traceability.md": `Create it with the rich matrix header:\n  ${RICH_HEADER}`,
      "docs/specs/adr/README.md":
        "Create docs/specs/adr/README.md as the index of your Architecture Decision Records.",
    };
    for (const f of REQUIRED_FILES) {
      if (!fs.existsSync(path.join(targetDir, f))) {
        this.fail("missing_required_file", `Missing required file: ${f}`, 1, [
          FILE_FIXES[f] || `Create ${f}.`,
          "Generated projects include every required file — compare with `specgate init --yes --out <tmp>`.",
        ]);
      }
    }

    const featuresDir = path.join(targetDir, "features");
    const featureFiles = findRecursive(featuresDir, (f) => f.endsWith(".feature"));
    if (featureFiles.length < 1) {
      this.fail("no_feature_files", "No .feature files were found in features/", 1, [
        "Write at least one Gherkin scenario, e.g. features/<area>/<name>.feature,",
        "or pull scenarios from a domain pack: specgate specops add --pack-repo <url> …",
      ]);
    }
    const featureCount = featureFiles.length;

    if (strictScenarios) {
      this.checkScenarioQuality(targetDir, featureFiles, delivering);
    }

    if (strictRequirements) {
      this.checkRequirementSyntax(targetDir);
    }

    const offenders = findUnresolvedPlaceholders(targetDir).map((rel) => path.join(targetDir, rel));
    if (offenders.length > 0) {
      this.logError("Unresolved placeholders detected");
      const tokens = new Set();
      for (const f of offenders) {
        const lines = fs.readFileSync(f, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (PLACEHOLDER_RE.test(lines[i])) {
            process.stderr.write(`${f}:${i + 1}:${lines[i]}\n`);
            for (const m of lines[i].match(/\{\{[A-Z_][A-Z0-9_]*\}\}/g) || []) tokens.add(m);
          }
        }
      }
      const varList = [...tokens].map((t: any) => String(t).replace(/[{}]/g, "")).join(", ");
      this.logFix([
        `Replace the tokens with real values, or re-expand the pack passing each variable:`,
        `  specgate specops sync --project-dir . (after adding the missing vars to .specops.lock)`,
        `Missing variables: ${varList}`,
      ]);
      process.exit(1);
    }

    const tracePath = path.join(targetDir, "docs/specs/traceability.md");
    const traceContent = fs.readFileSync(tracePath, "utf8");

    // Every judgement about the matrix's contents comes from the use case; this
    // command's job from here is to render what it found and pick the exit code.
    const specPath = path.join(targetDir, "spec.md");
    const {
      report,
      mode,
      requirements: reqsInMatrix,
    } = new ValidateProjectUseCase(new DiskTraceabilityRepository()).checkMatrix(traceContent, {
      strictTdd,
      // Every place a requirement's prose is allowed to live. Three shapes are
      // in the wild and all three are legitimate: `## REQ-NNN` sections (what
      // `adopt` writes), the `| ID | Requirement |` table in §8 (what the
      // original `init` template wrote, and what this repository still uses),
      // and a capability spec under docs/specs/capabilities/ (ADR-0022).
      // Reading only the root spec.md flagged 14 requirements in our own repo
      // that are documented perfectly well one directory down.
      specContent: this.collectSpecProse(targetDir, specPath),
    });

    const strictTddViolations = report.findings
      .filter((f) => f.code === "strict_tdd_violation")
      .map((f) => f.message);

    for (const finding of report.findings) {
      if (finding.code === "strict_tdd_violation") continue; // reported together, below
      // Severity decides. This loop used to fail on anything the report
      // carried, which turned the first warning added to `checkMatrix` into a
      // red build — the exact green-to-red flip ADR-0026 exists to avoid.
      if (finding.severity === "warning") {
        this.logWarn(finding.message);
        if (finding.fixLines?.length) this.logFix([...finding.fixLines]);
        continue;
      }
      this.fail(finding.code, finding.message, 1, [...(finding.fixLines || [])]);
      return;
    }

    const traceMode = mode as string;

    const TDD_FIXES: Record<string, string> = {
      "TDD-1":
        "Write the test first, then set its path in the row's 'Test artifact' column (or move the status back to Draft).",
      "TDD-2":
        "Give the row a Scenario ID that matches a scenario in its feature file (e.g. SCN-001).",
      "TDD-3":
        "Add a traceability row for the requirement — run `specgate plan` to list what each REQ still needs.",
    };

    if (strictTddViolations.length > 0) {
      if (this.io.json) {
        this.io.fail(
          { validation: null },
          strictTddViolations.map((v) => {
            const tdd = v.slice(1, 6);
            return error(`strict_tdd_${tdd.split("-")[1]}`, v, {
              fix: TDD_FIXES[tdd],
            });
          })
        );
        return;
      }
      this.logError("--strict-tdd violations detected:");
      for (const v of strictTddViolations) {
        process.stderr.write(`  ${v}\n`);
      }
      const codes = new Set(strictTddViolations.map((v) => v.slice(1, 6)));
      this.logFix([...codes].sort().map((c) => `${c}: ${TDD_FIXES[c]}`));
      process.exit(1);
    }

    this.checkScenarioTags(targetDir, traceContent);
    if (strictLinks) {
      this.checkDeclaredArtifactsExist(targetDir, traceContent, delivering);
    }
    if (strictCoverage) {
      this.checkScenarioCoverage(targetDir, traceContent);
    }

    for (const ff of featureFiles.sort()) {
      const rel = path.relative(targetDir, ff).split(path.sep).join("/");
      if (!traceContent.includes(rel)) {
        const exampleRow =
          traceMode === "rich"
            ? `| REQ-TBD | SCN-TBD | \`${rel}\` | UC-TBD | TBD | TBD | TBD | TBD | TBD | Draft |`
            : `| \`${rel}\` | <scenario> | TBD | Draft |`;
        this.fail("feature_not_in_matrix", `Feature file missing from traceability.md: ${rel}`, 1, [
          "Add a row for it to docs/specs/traceability.md, e.g.:",
          `  ${exampleRow}`,
        ]);
      }
    }

    const useCasesPath = path.join(targetDir, "docs/specs/use-cases.md");
    if (fs.existsSync(useCasesPath)) {
      const content = fs.readFileSync(useCasesPath, "utf8");
      if (
        !content.includes(
          "| ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits"
        )
      ) {
        this.fail(
          "use_cases_header_missing",
          "use-cases.md is missing the expected table header",
          1,
          [
            "Start the use-case table with:",
            "  | ID | Use Case | Actor | Requirement | Command/Query | Aggregate | Emits |",
          ]
        );
      }
    }
    const eventsPath = path.join(targetDir, "docs/specs/events.md");
    if (fs.existsSync(eventsPath)) {
      const content = fs.readFileSync(eventsPath, "utf8");
      if (!content.includes("| ID | Event | Producer | Consumers | Payload |")) {
        this.fail("events_header_missing", "events.md is missing the expected table header", 1, [
          "Start the events table with:",
          "  | ID | Event | Producer | Consumers | Payload |",
        ]);
      }
    }

    let changeCount = 0;
    const changesDir = path.join(targetDir, "docs/specs/changes");
    if (fs.existsSync(changesDir)) {
      const ids = listChangeIds(targetDir);
      changeCount = ids.length;
      const problems: string[] = [];
      const rawProblems: any[] = [];
      for (const id of ids) {
        const result = new ValidateChangeUseCase(new DiskProjectRepository(targetDir)).execute(id, {
          strict: false,
        });
        for (const d of result.diagnostics) {
          if (d.severity === "error") {
            rawProblems.push(d);
            problems.push(formatDiagnostic(d));
          }
        }
      }
      if (problems.length > 0) {
        if (this.io.json) {
          this.io.fail({ validation: null }, rawProblems);
          return;
        }
        this.logError("Active changes have invalid delta specs:");
        for (const line of problems) process.stderr.write(`  ${line}\n`);
        process.exit(1);
      }
    }

    let lockChecked = 0;
    let lockAdvisories: any[] = [];
    if (againstLock) {
      const result = checkAgainstLock(targetDir, {});
      lockChecked = result.checked;
      const errors = result.diagnostics.filter((d: any) => d.severity === "error");
      const rest = result.diagnostics.filter((d: any) => d.severity !== "error");

      if (!this.io.json) {
        for (const d of rest) process.stdout.write(`  ${formatDiagnostic(d)}\n`);
      }

      if (errors.length > 0) {
        if (this.io.json) {
          this.io.fail({ validation: null }, result.diagnostics);
          return;
        }
        this.logError("--against-lock violations detected:");
        for (const d of errors) process.stderr.write(`  ${formatDiagnostic(d)}\n`);
        process.exit(1);
      }
      lockAdvisories = rest;
    }

    {
      const graph = requirementGraphFromProject(targetDir, [...reqsInMatrix]);
      const graphProblems: any[] = [];

      for (const cycle of graph.cycles) {
        const loop = [...cycle, cycle[0]].join(" → ");
        graphProblems.push(
          error("requirement_cycle", `Requirements depend on each other in a cycle: ${loop}`, {
            target: cycle[0],
            fix:
              `Remove one \`depends=\` from the csda:trace comment of one of them — ` +
              `${cycle.join(", ")} cannot all come after each other.`,
          })
        );
      }

      for (const { requirement, dependency } of graph.unknown) {
        graphProblems.push(
          error(
            "unknown_dependency",
            `${requirement} declares depends=${dependency}, which is not a requirement in this project.`,
            {
              target: requirement,
              fix: `Correct the id in ${requirement}'s csda:trace comment, or add a traceability row for ${dependency}.`,
            }
          )
        );
      }

      for (const requirement of graph.selfReferential) {
        graphProblems.push(
          error("self_dependency", `${requirement} declares that it depends on itself.`, {
            target: requirement,
            fix: `Remove \`depends=${requirement}\` from its csda:trace comment.`,
          })
        );
      }

      if (graphProblems.length > 0) {
        if (this.io.json) {
          this.io.fail({ validation: null }, graphProblems);
          return;
        }
        this.logError("Requirement dependency problems:");
        for (const d of graphProblems) process.stderr.write(`  ${formatDiagnostic(d)}\n`);
        process.exit(1);
      }
    }

    const skeletonOnly = this.isAdoptionSkeletonOnly(targetDir, featureFiles);
    const advisories = skeletonOnly
      ? lockAdvisories.concat([
          {
            severity: "warning",
            code: "adoption_not_retrofilled",
            message:
              "The only scenario in this project is the adoption baseline. Nothing the codebase actually does is specified yet.",
            target: "features/adoption/baseline.feature",
            fix: 'Retro-fill one requirement you already rely on: specgate onboard, then specgate req add "<behaviour>" and specgate req link.',
          },
        ])
      : lockAdvisories;

    if (this.io.json) {
      this.io.emit({
        validation: {
          projectDir: targetDir,
          passed: true,
          features: featureCount,
          activeChanges: changeCount,
          traceabilityMode: traceMode,
          strictTdd,
          againstLock,
          packsChecked: lockChecked,
          adoptionRetrofilled: !skeletonOnly,
        },
        status: advisories,
      });
      process.exit(EXIT.OK);
    }

    this.logInfo("✅ Validation passed");
    this.logInfo(`- Features detected: ${featureCount}`);
    if (changeCount > 0) this.logInfo(`- Active changes: ${changeCount} (deltas valid)`);
    if (againstLock) {
      this.logInfo(
        lockChecked > 0
          ? `- Lock drift gate: passed (${lockChecked} pack(s) checked)`
          : "- Lock drift gate: no locked packs to check"
      );
    }
    this.logInfo("- Base SDD structure: complete");
    this.logInfo(`- Traceability mode: ${traceMode}`);
    if (strictTdd) {
      // The count travels with the pass. `passed` over rows that were never
      // checked is how the tool and its own documentation ended up disagreeing.
      let exempt = 0;
      try {
        exempt = countDraftExempt(parseTraceabilityRows(traceContent).rows || []);
      } catch {
        exempt = 0;
      }
      this.logInfo(
        exempt > 0
          ? `- Strict TDD gate: passed (${exempt} row(s) exempt — still Draft, so not checked)`
          : "- Strict TDD gate: passed"
      );
      if (exempt > 0) {
        this.logFix([
          "A Draft row owes nothing yet, so --strict-tdd skips it. It starts being",
          "checked the moment its Status leaves Draft — `specgate done <REQ>` does that.",
        ]);
      }
    }
    if (skeletonOnly) {
      this.logWarn("Adoption never retro-filled — the only scenario is the adoption baseline.");
      this.logFix([
        "This passes, but it certifies the skeleton, not the code.",
        "  specgate onboard                     # what this codebase already implies",
        '  specgate req add "<behaviour>"        # one requirement you already rely on',
        "  specgate req link REQ-NNN --code <path> --test <path>",
      ]);
    }
    process.exit(0);
  }
}
