import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveProjectDir, findCliRoot } from "../../../lib/project-root";
import { diagnostic } from "../../../lib/diagnostics";
import { findUnresolvedPlaceholders } from "../../../lib/placeholders";
import { analyseGherkinSource } from "../../../../packages/core/src/domain/GherkinQuality";
import { agentIo, wantsJson, EXIT } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { MERGE_DRIVER_NAME } from "../../../harness/init";
import { hasGherkinRunner } from "../../../../packages/core/src/domain/TestCommand";
import {
  listChangeIds,
  listArchivedIds,
  listDeltas,
  taskProgress,
  readConfig,
  paths,
  parseTasks,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";

const RICH_HEADER =
  "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |";
const LEGACY_HEADER = "| Feature | Scenario | Technical artifact | Status |";

export interface Finding {
  level: "ok" | "warn" | "error";
  check: string;
  detail: string;
  fix?: string;
}

export function nodeFloor(rootDir = findCliRoot(__dirname)): number {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const raw = (pkg.engines && pkg.engines.node) || ">=22";
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : 22;
  } catch {
    return 22;
  }
}

export class DoctorCommand extends BaseCommand {
  private findings: Finding[] = [];

  private ok(check: string, detail: string) {
    this.findings.push({ level: "ok", check, detail });
  }

  private warn(check: string, detail: string, fix?: string) {
    this.findings.push({ level: "warn", check, detail, fix });
  }

  private recordError(check: string, detail: string, fix?: string) {
    this.findings.push({ level: "error", check, detail, fix });
  }

  private walk(dir: string): string[] {
    const out: string[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...this.walk(full));
      else out.push(full);
    }
    return out;
  }

  private readIfExists(p: string): string | null {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return null;
    }
  }

  private describeInstall() {
    const rootDir = findCliRoot(__dirname);
    let version = "unknown";
    try {
      version = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version;
    } catch {
      // An unreadable or malformed package.json leaves version "unknown", which
      // is what doctor reports. Failing here would hide every other check.
    }

    const posix = rootDir.split(path.sep).join("/");
    let kind = "local checkout";
    if (/\/(_npx|\.npm\/_npx)\//.test(posix)) kind = "npx cache — temporary, not installed";
    else if (/\/lib\/node_modules\//.test(posix)) kind = "global install";
    else if (/\/node_modules\//.test(posix)) kind = "project dependency";

    return { version, rootDir, kind };
  }

  private checkEnvironment() {
    const install = this.describeInstall();
    this.ok("specgate", `v${install.version} — ${install.kind}\n     ${install.rootDir}`);

    const floor = nodeFloor(install.rootDir);
    const major = Number(process.versions.node.split(".")[0]);
    if (major >= floor) {
      this.ok("Node.js", `v${process.versions.node}`);
    } else {
      this.recordError(
        "Node.js",
        `v${process.versions.node} is below the required minimum`,
        `Install Node.js >= ${floor} (https://nodejs.org) or use nvm/fnm to switch.`
      );
    }

    const git = spawnSync("git", ["--version"], { encoding: "utf8", shell: false });
    if (git.status === 0) {
      this.ok("git", git.stdout.trim());
    } else {
      this.warn(
        "git",
        "git is not available on PATH",
        "Install git — init, specops (remote packs) and harness need it."
      );
    }
  }

  private checkStructure(dir: string) {
    const hasRules = ["AGENTS.md", "AI_RULES.md"].some((f) => fs.existsSync(path.join(dir, f)));
    const required = [
      "spec.md",
      ...(hasRules ? [] : ["AGENTS.md"]),
      "README.md",
      "docs/specs/traceability.md",
      "docs/specs/adr/README.md",
    ];
    const missing = required.filter((f) => !fs.existsSync(path.join(dir, f)));
    if (missing.length === 0) {
      this.ok("SDD structure", "all required files present");
    } else {
      for (const f of missing) {
        this.recordError(
          "SDD structure",
          `missing required file: ${f}`,
          "Run `specgate adopt` (brownfield) to generate missing skeleton files without overwriting anything."
        );
      }
    }

    if (!fs.existsSync(path.join(dir, "features"))) {
      this.recordError(
        "features/",
        "directory does not exist",
        "Create features/ and add at least one .feature file (or `specops add` a pack)."
      );
    }
  }

  private readSpecTree(dir: string): string | null {
    const parts: string[] = [];
    const root = this.readIfExists(path.join(dir, "spec.md"));
    if (root !== null) parts.push(root);

    const capabilities = path.join(dir, "docs/specs/capabilities");
    if (fs.existsSync(capabilities)) {
      for (const entry of fs.readdirSync(capabilities, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const spec = this.readIfExists(path.join(capabilities, entry.name, "spec.md"));
        if (spec !== null) parts.push(spec);
      }
    }
    return parts.length > 0 ? parts.join("\n") : null;
  }

  private checkTraceability(dir: string) {
    const tracePath = path.join(dir, "docs/specs/traceability.md");
    const trace = this.readIfExists(tracePath);
    if (trace === null) return;

    let mode = null;
    if (trace.includes(RICH_HEADER)) mode = "rich";
    else if (trace.includes(LEGACY_HEADER)) mode = "legacy";
    if (!mode) {
      this.recordError(
        "traceability.md",
        "matrix header not recognised",
        `Paste the rich header into docs/specs/traceability.md:\n      ${RICH_HEADER}`
      );
      return;
    }
    this.ok("traceability.md", `${mode} matrix`);

    const featuresDir = path.join(dir, "features");
    const featureFiles = fs.existsSync(featuresDir)
      ? this.walk(featuresDir).filter((f) => f.endsWith(".feature"))
      : [];
    if (featureFiles.length === 0) {
      this.recordError(
        "features/",
        "no .feature files found",
        "Write at least one Gherkin scenario or `specops add` a domain pack."
      );
    } else {
      this.ok("features/", `${featureFiles.length} feature file(s)`);
    }

    const orphanFeatures = featureFiles
      .map((ff) => path.relative(dir, ff).split(path.sep).join("/"))
      .filter((rel) => !trace.includes(rel));
    for (const rel of orphanFeatures) {
      this.recordError(
        "orphan feature",
        `${rel} has no row in traceability.md`,
        `Add a matrix row referencing \`${rel}\` (validate prints a paste-ready one).`
      );
    }

    const referenced = trace.match(/`(features\/[^`]+\.feature)`/g) || [];
    for (const raw of referenced) {
      const rel = raw.replace(/`/g, "");
      if (!fs.existsSync(path.join(dir, rel))) {
        this.recordError(
          "dangling matrix row",
          `traceability.md references ${rel}, which does not exist`,
          `Create ${rel} or fix/remove the row pointing at it.`
        );
      }
    }

    const spec = this.readSpecTree(dir);
    if (spec !== null) {
      const specReqs = new Set(spec.match(/\bREQ-\d+\b/g) || []);
      const matrixReqs = new Set(trace.match(/\bREQ-\d+\b/g) || []);
      for (const req of specReqs) {
        if (!matrixReqs.has(req)) {
          this.warn(
            "requirement coverage",
            `${req} is in spec.md but has no traceability row`,
            trace.includes("specgate:derived")
              ? "Run `specgate matrix` — the matrix is generated from spec.md."
              : "Add a row for it — `specgate plan` lists what each REQ still needs."
          );
        }
      }
      for (const req of matrixReqs) {
        if (req !== "REQ-TBD" && !specReqs.has(req)) {
          this.warn(
            "requirement coverage",
            `${req} is in traceability.md but spec.md has no section for it`,
            `Add a \`## ${req} — <title>\` section to spec.md (or remove the stale row).`
          );
        }
      }
    }
  }

  private checkCapabilityDrift(dir: string) {
    const capabilities = path.join(dir, "docs/specs/capabilities");
    if (!fs.existsSync(capabilities)) return;

    const trace = this.readIfExists(path.join(dir, "docs/specs/traceability.md"));
    if (trace === null) return;
    const inMatrix = new Set(trace.match(/\bREQ-\d+\b/g) || []);

    let checked = 0;
    for (const entry of fs.readdirSync(capabilities, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const spec = this.readIfExists(path.join(capabilities, entry.name, "spec.md"));
      if (spec === null) continue;
      for (const req of new Set(spec.match(/\bREQ-\d+\b/g) || [])) {
        checked++;
        if (!inMatrix.has(req)) {
          this.warn(
            "capability drift",
            `${req} is in the ${entry.name} capability spec but has no traceability row`,
            "`specgate matrix` regenerates it from the capability spec" +
              " — or re-run `specgate change archive`, which writes the row for you."
          );
        }
      }
    }
    if (checked > 0)
      this.ok("capability specs", `${checked} requirement(s) reconciled with the matrix`);
  }

  private checkChanges(dir: string) {
    const changesDir = path.join(dir, "docs/specs/changes");
    if (!fs.existsSync(changesDir)) {
      this.ok("changes", "no change directory (not using the change lifecycle — that is fine)");
      return;
    }

    const active = listChangeIds(dir);
    const archived = listArchivedIds(dir);

    for (const id of active) {
      const deltas = listDeltas(dir, id);
      const config = readConfig(dir, id);
      const progress = taskProgress(dir, id);

      if (progress.total > 0 && progress.remaining === 0) {
        this.warn(
          "stale change",
          `${id} has all ${progress.total} tasks checked but is still active`,
          `Archive it: specgate change archive ${id} --dry-run`
        );
      }

      if (deltas.length === 0 && config.skip_specs !== true) {
        this.warn(
          "empty change",
          `${id} declares no delta specs`,
          `Write one under docs/specs/changes/${id}/specs/<capability>/spec.md, or set skip_specs: true in its change.yaml if this change has no behavioural impact.`
        );
      }
    }

    for (const id of archived) {
      const raw = this.readIfExists(path.join(paths(dir).archive, id, "tasks.md"));
      if (raw === null) continue;
      const tasks = parseTasks(raw);
      const remaining = tasks.filter((t) => !t.done).length;
      if (tasks.length > 0 && remaining > 0) {
        this.warn(
          "archived with open tasks",
          `${id} was archived with ${remaining} task(s) unchecked`,
          "Either the tasks were not needed — delete them — or the work is unfinished and needs a follow-up change."
        );
      }
    }

    if (active.length === 0 && archived.length === 0) {
      this.ok("changes", "no changes yet");
    } else {
      this.ok("changes", `${active.length} active, ${archived.length} archived`);
    }
  }

  private checkPlaceholders(dir: string) {
    const offenders = findUnresolvedPlaceholders(dir);
    if (offenders.length === 0) {
      this.ok("placeholders", "no unresolved {{...}} tokens");
    } else {
      for (const f of offenders) {
        this.recordError(
          "placeholders",
          `unresolved {{...}} tokens in ${f}`,
          "Replace them with real values, or re-expand the pack with the missing --var values."
        );
      }
    }
  }

  /**
   * `.gitattributes` is committed; the merge driver it names is not.
   *
   * `merge.csda-matrix.driver` lives in each clone's git config, so a project
   * that set it up still merges by lines on every other machine and in CI —
   * and the symptom is a conflict in `traceability.md` during a merge, which is
   * a long way from the cause. Warn, never fail: without the driver git falls
   * back to its built-in merge, which is what the project had before. Unhelped
   * is not broken.
   */
  private checkMergeDriver(dir: string) {
    const attributes = path.join(dir, ".gitattributes");
    if (!fs.existsSync(attributes)) return;
    if (!fs.readFileSync(attributes, "utf8").includes(`merge=${MERGE_DRIVER_NAME}`)) return;

    const get = (key: string) =>
      String(
        spawnSync("git", ["-C", dir, "config", "--get", key], { encoding: "utf8" }).stdout || ""
      ).trim();

    const driver = get(`merge.${MERGE_DRIVER_NAME}.driver`);
    const name = get(`merge.${MERGE_DRIVER_NAME}.name`);

    if (driver) {
      this.ok("merge driver", "traceability.md merges row by row");
      return;
    }

    if (name) {
      // Half-registered is the one state worse than unregistered: git refuses
      // the merge outright with "custom merge driver ... lacks command line",
      // so the file cannot be merged at all. An error, not a warning.
      this.recordError(
        "merge driver",
        `merge.${MERGE_DRIVER_NAME}.name is set but its driver command is missing — git will refuse to merge traceability.md`,
        `Either finish the registration with \`specgate harness init --project-dir .\`, or remove the half: git config --unset merge.${MERGE_DRIVER_NAME}.name`
      );
      return;
    }

    this.warn(
      "merge driver",
      ".gitattributes routes traceability.md to the csda merge driver, but this clone has not registered it",
      "Run `specgate harness init --project-dir .` here. Until then git merges the matrix by lines, so two parallel harness branches collide on adjacent rows."
    );
  }

  /**
   * Does the declared architecture profile still describe this project?
   *
   * ADR-0022 makes the profile a declaration rather than an inference, which
   * only stays honest if something notices when it stops being true: a
   * `minimal` project that has grown a domain model, or a `tactical-ddd` one
   * whose `aggregates.md` has been an empty heading for six months. Both are
   * warnings — the profile is a statement of intent, and a project is allowed
   * to be mid-move.
   */
  private checkArchitectureProfile(dir: string) {
    // AGENTS.md says `… · architecture: X · …`; a legacy AI_RULES.md `- Architecture: X`.
    const rules = ["AGENTS.md", "AI_RULES.md"]
      .map((f) => path.join(dir, f))
      .find((f) => fs.existsSync(f));
    if (!rules) return;
    const declared = /(?:^|·)\s*-?\s*architecture:\s*([a-z-]+)/im.exec(
      fs.readFileSync(rules, "utf8")
    )?.[1];
    const rulesName = path.basename(rules);
    if (!declared) return;

    const known = ["minimal", "layered", "tactical-ddd"];
    if (!known.includes(declared)) {
      this.warn(
        "architecture",
        `${rulesName} declares an unknown architecture profile '${declared}'`,
        `Use one of: ${known.join(", ")}.`
      );
      return;
    }

    // The signal is the matrix, not the domain documents.
    //
    // Those documents ship with placeholder rows — `AGG-001 | CoreAggregate`,
    // `CMD-001 | ExampleCommand` — so "the file has table rows" is true the
    // moment a project is generated and says nothing about whether anyone
    // modelled anything. The matrix is the artefact the project actually
    // maintains, and its Aggregate and Event columns hold `-` until they are
    // used, which is exactly the question being asked.
    const matrix = path.join(dir, "docs", "specs", "traceability.md");
    if (!fs.existsSync(matrix)) return;

    const rows = fs
      .readFileSync(matrix, "utf8")
      .split("\n")
      .filter((l) => l.trim().startsWith("|") && !l.includes("---") && /REQ-/.test(l));

    const modelsDomain = rows.some((row) => {
      const cells = row.split("|").map((c) => c.trim());
      const [aggregate, event] = [cells[6], cells[7]];
      const stated = (v: string) => v && v !== "-" && v !== "TBD";
      return stated(aggregate) || stated(event);
    });

    if (declared === "minimal" && modelsDomain) {
      this.warn(
        "architecture",
        "profile is 'minimal' but requirements name aggregates or events in the matrix",
        `Move to \`layered\` or \`tactical-ddd\` in ${rulesName}. A profile the project has outgrown tells the agent the wrong thing.`
      );
      return;
    }

    // Only worth saying once a project has substance: a freshly generated one
    // has modelled nothing yet, and that is not drift, it is Tuesday.
    if (declared === "tactical-ddd" && !modelsDomain && rows.length > 1) {
      this.warn(
        "architecture",
        `profile is 'tactical-ddd' but none of its ${rows.length} requirements names an aggregate or event`,
        "Either model the domain, or declare `layered` — the rulebook is telling the agent to map every command to an aggregate the project does not have."
      );
      return;
    }

    this.ok("architecture", `${declared} — matches what the project models`);
  }

  /**
   * Scenarios that cannot fail, reported as findings rather than as a gate (A3).
   *
   * `specgate validate --strict-scenarios` is the gate; this is the advisory. The
   * split is deliberate: a repository brought in with `specgate adopt` can carry
   * dozens of features written before this tool existed, and failing its first
   * `validate` teaches people to skip the gate rather than fix the scenarios.
   * `doctor` is where this project already reports "here is what is weak, here
   * is the fix", so that is where the gradual path belongs.
   *
   * Errors are reported as errors even so, because they are not weakness: a
   * scenario Cucumber sees as empty reports `0 steps · exit 0`, so the gate
   * approves the requirement without having checked it (H14).
   */
  private checkScenarioQuality(dir: string) {
    const featuresDir = path.join(dir, "features");
    if (!fs.existsSync(featuresDir)) return;

    const files: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".feature")) files.push(full);
      }
    };
    walk(featuresDir);
    if (files.length === 0) return;

    let errors = 0;
    let warnings = 0;
    for (const file of files.sort()) {
      const rel = path.relative(dir, file).split(path.sep).join("/");
      for (const f of analyseGherkinSource(fs.readFileSync(file, "utf8"), rel)) {
        const where = f.line ? `${rel}:${f.line}` : rel;
        if (f.severity === "error") {
          errors += 1;
          this.recordError("scenarios", `${where} ${f.message}`, f.fix || "");
        } else {
          warnings += 1;
          this.warn("scenarios", `${where} ${f.message}`, f.fix || "");
        }
      }
    }
    if (errors === 0 && warnings === 0) {
      // "well-formed", not "runnable". This reads the Gherkin — When, Then,
      // three steps, no vague step text — and never executes anything. Calling
      // that "runnable" contradicted the harness prompt, which in the same
      // project said nothing executes a `.feature` here. One of the two was
      // describing the file and calling it the run.
      const runner = hasGherkinRunner({
        exists: (rel: string) => fs.existsSync(path.join(dir, rel)),
        read: (rel: string) => {
          try {
            return fs.readFileSync(path.join(dir, rel), "utf8");
          } catch {
            return null;
          }
        },
      });
      this.ok(
        "scenarios",
        `${files.length} feature file(s), every scenario well-formed` +
          (runner ? "" : " — no Gherkin runner here, so nothing executes them")
      );
    } else if (errors === 0) {
      this.warn(
        "scenarios",
        `${warnings} scenario(s) could be sharper`,
        "Run `specgate validate <dir> --strict-scenarios` to gate on this."
      );
    }
  }

  private checkSampleRequirement(dir: string) {
    if (!fs.existsSync(path.join(dir, ".specops.lock"))) return;
    const traceRaw = this.readIfExists(path.join(dir, "docs/specs/traceability.md"));
    if (traceRaw === null) return;

    const row = traceRaw.split("\n").find((line) => /^\|\s*REQ-000\s*\|/.test(line));
    if (!row) return;

    const untouched = row.includes("features/core/health.feature") && /\bDraft\b/.test(row);
    if (!untouched) {
      this.ok("sample requirement", "REQ-000 has been adapted — treating it as yours");
      return;
    }

    this.warn(
      "sample requirement",
      "REQ-000 is the scaffold's starter requirement and a domain pack is installed — " +
        "the pack's own requirements now cover this",
      "Remove the REQ-000 row from docs/specs/traceability.md and delete " +
        "features/core/health.feature, unless you meant to keep it. " +
        "New projects can skip it with `specgate init --no-sample-req` (implied by --from-pack)."
    );
  }

  private checkSpecops(dir: string) {
    const lockPath = path.join(dir, ".specops.lock");
    const lockRaw = this.readIfExists(lockPath);
    if (lockRaw === null) {
      this.ok("specops", "no lockfile (packs not used — that is fine at L1/L2)");
      return;
    }
    let lock: any;
    try {
      lock = JSON.parse(lockRaw);
    } catch (err: any) {
      this.recordError(
        "specops",
        `.specops.lock is not valid JSON: ${err.message}`,
        "Restore it from git history, or delete it and re-run `specops add` for each pack."
      );
      return;
    }
    const packs = Array.isArray(lock.packs) ? lock.packs : [];
    this.ok("specops", `.specops.lock with ${packs.length} pack(s)`);

    if (packs.length > 0 && !fs.existsSync(path.join(dir, ".specops", "baseline"))) {
      this.warn(
        "specops baseline",
        ".specops/baseline/ is missing — `specops sync` cannot three-way merge",
        "Re-run `specops sync` to regenerate it, and commit .specops/baseline/."
      );
    }
  }

  public execute() {
    const argv = this.args;
    const start = argv[0] === "doctor" ? 1 : 0;
    let projectDir = null;
    for (let i = start; i < argv.length; i++) {
      if (argv[i] === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
      else if (argv[i] === "--json") continue;
      else if (argv[i] === "--help" || argv[i] === "-h") {
        process.stdout.write(
          "Usage:\n  specgate doctor [--project-dir <dir>] [--json]\n\n" +
            "Runs every diagnostic (environment, structure, traceability in both\n" +
            "directions, placeholders, specops lockfile) and prints a fix per finding.\n"
        );
        process.exit(0);
      }
    }

    const io = agentIo(wantsJson(argv));
    this.checkEnvironment();

    let dir = ".";
    try {
      dir = resolveProjectDir(projectDir || ".");
    } catch {
      dir = projectDir || ".";
    }

    if (!io.json) process.stdout.write(`\n🩺 Doctor report for: ${dir}\n\n`);

    if (!fs.existsSync(path.join(dir, "spec.md"))) {
      this.recordError(
        "project",
        "spec.md not found — this directory is not spec-driven yet",
        "Run `specgate adopt` here (existing code) or `init` (new project)."
      );
    } else {
      this.checkStructure(dir);
      this.checkTraceability(dir);
      this.checkCapabilityDrift(dir);
      this.checkChanges(dir);
      this.checkPlaceholders(dir);
      this.checkSpecops(dir);
      this.checkMergeDriver(dir);
      this.checkArchitectureProfile(dir);
      this.checkSampleRequirement(dir);
      this.checkScenarioQuality(dir);
    }

    const errors = this.findings.filter((f) => f.level === "error").length;
    const warns = this.findings.filter((f) => f.level === "warn").length;

    if (io.json) {
      const SEVERITY_OF = { ok: "info", warn: "warning", error: "error" };
      io.emit({
        doctor: {
          projectDir: dir,
          errors,
          warnings: warns,
          passed: this.findings.length - errors - warns,
        },
        status: this.findings.map((f) =>
          diagnostic(
            SEVERITY_OF[f.level] as any,
            `doctor_${String(f.check)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, "")}`,
            f.detail,
            { target: f.check, ...(f.fix ? { fix: f.fix } : {}) }
          )
        ),
      });
      process.exit(errors === 0 ? EXIT.OK : EXIT.FAILURE);
    }

    const icons = { ok: "✅", warn: "⚠️", error: "❌" };
    for (const f of this.findings) {
      process.stdout.write(`${icons[f.level]} ${f.check}: ${f.detail}\n`);
      if (f.fix) process.stdout.write(`   💡 Fix: ${f.fix}\n`);
    }

    process.stdout.write(
      `\n${errors === 0 ? "✅" : "❌"} ${errors} error(s), ${warns} warning(s), ` +
        `${this.findings.length - errors - warns} check(s) passed\n`
    );
    process.exit(errors === 0 ? EXIT.OK : EXIT.FAILURE);
  }
}
