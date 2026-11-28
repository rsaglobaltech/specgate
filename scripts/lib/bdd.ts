/**
 * Executable scenarios in every project (bdd-gate REQ-660 … REQ-663): an
 * approved change's scenarios written as feature files before any code, the
 * gate requiring a runner for them and the files up to date, apply running a
 * requirement's scenarios, and new, adopted and migrated projects set up for it.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { parseDelta } from "../../packages/core/src/domain/SpecParser";
import { renderDeltaFeature } from "../../packages/core/src/domain/DeltaFeature";
import { specgateTagsIn } from "../../packages/core/src/domain/GherkinTags";
import type { Diagnostic } from "../../packages/core/src/domain/Diagnostic";
import { error, warning } from "./diagnostics";
import { GATE_POLICY_FILE, readGatePolicy } from "./gate-policy";
import { changeApprovals } from "./approvals";

const CHANGES = path.join("docs", "specs", "changes");

/** The tag a feature file carries while its change is open. */
export const changeTag = (id: string) => `@change:${id}`;

export interface ChangeFeature {
  requirement: string;
  /** Relative to the project, with `/`. */
  file: string;
  contents: string;
  /** The scenario tags the delta gives it. */
  scenarios: string[];
}

/** A change's open delta files: specs/<capability>/spec.md. */
function deltasOf(projectDir: string, id: string): Array<{ capability: string; text: string }> {
  const specs = path.join(projectDir, CHANGES, id, "specs");
  if (!fs.existsSync(specs)) return [];
  return fs
    .readdirSync(specs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(specs, d.name, "spec.md")))
    .map((d) => ({
      capability: d.name,
      text: fs.readFileSync(path.join(specs, d.name, "spec.md"), "utf8"),
    }));
}

/** The feature file each requirement of a change gets: its scenarios, tagged with the change. */
export function changeFeatures(projectDir: string, id: string): ChangeFeature[] {
  const out: ChangeFeature[] = [];
  for (const { capability, text } of deltasOf(projectDir, id)) {
    const delta = parseDelta(text);
    for (const req of [...delta.added, ...delta.modified]) {
      if (!req.id || !req.scenarios.length) continue;
      const named = String((req.trace as { feature?: unknown } | undefined)?.feature ?? "")
        .replace(/`/g, "")
        .trim();
      const file = named.endsWith(".feature") ? named : `features/${capability}/${req.id}.feature`;
      const rendered = renderDeltaFeature(req, capability);
      // The change's tag goes before the feature, after a `# language:` line.
      const lines = rendered.split("\n");
      const at = /^#\s*language:/.test(lines[0] ?? "") ? 1 : 0;
      lines.splice(at, 0, changeTag(id));
      out.push({
        requirement: req.id,
        file,
        contents: lines.join("\n"),
        scenarios: req.scenarios.map((s) => (s.id ? `@${s.id}` : null)).filter(Boolean) as string[],
      });
    }
  }
  return out;
}

/** Writes a change's feature files (REQ-660); the files written, relative. */
export function syncChangeFeatures(projectDir: string, id: string): string[] {
  const written: string[] = [];
  for (const f of changeFeatures(projectDir, id)) {
    const full = path.join(projectDir, f.file);
    const before = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
    if (before === f.contents) continue;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.contents, "utf8");
    written.push(f.file);
  }
  return written;
}

/** Writes them once the change is approved: before any code (REQ-660). */
export function syncIfApproved(projectDir: string, id: string): string[] {
  return changeApprovals(projectDir, id).approved ? syncChangeFeatures(projectDir, id) : [];
}

/** Drops a change's tag from the feature files once it is archived (REQ-660). */
export function dropChangeTag(projectDir: string, id: string): string[] {
  const root = path.join(projectDir, "features");
  const changed: string[] = [];
  const tag = new RegExp(
    `^${changeTag(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*\\r?\\n`,
    "m"
  );
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".feature")) {
        const text = fs.readFileSync(full, "utf8");
        if (tag.test(text)) {
          fs.writeFileSync(full, text.replace(tag, ""), "utf8");
          changed.push(path.relative(projectDir, full).split(path.sep).join("/"));
        }
      }
    }
  };
  walk(root);
  return changed;
}

/** The open changes (not archived). */
function openChanges(projectDir: string): string[] {
  const root = path.join(projectDir, CHANGES);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "archive")
    .map((d) => d.name)
    .sort();
}

/**
 * What the gate says of executable scenarios (REQ-661): in a project with
 * `bdd: required`, a runner and every approved requirement's file up to date;
 * in one that does not say it yet, a warning to migrate.
 */
export function bddFindings(projectDir: string, bddCmd: string | undefined): Diagnostic[] {
  const policy = readGatePolicy(projectDir);
  if (policy.bdd !== "required")
    return [
      warning(
        "bdd_not_set_up",
        "The scenarios are not executable yet: no feature runner is required by this project's gate.",
        {
          file: GATE_POLICY_FILE,
          fix: "specgate migrate bdd — the scenarios become feature files a runner checks, before any code.",
        }
      ),
    ];
  const out: Diagnostic[] = [];
  if (baselineUnskipped(projectDir) !== null)
    out.push(
      warning(
        "bdd_baseline_runs",
        "The adoption baseline is a scenario no step runs: a full run of the feature files fails on it.",
        {
          file: BASELINE,
          fix: "specgate migrate bdd — it tags the baseline @skip; the test command the gate runs keeps that promise.",
        }
      )
    );
  const approved = openChanges(projectDir).filter((id) => changeApprovals(projectDir, id).approved);
  // A runner is owed once there are approved scenarios to run; before, the gate reminds.
  if (!bddCmd?.trim()) {
    const say = approved.length ? error : warning;
    out.push(
      say(
        "bdd_cmd_missing",
        approved.length
          ? `The gate requires executable scenarios, and no bdd_cmd runs those of ${approved.join(", ")}.`
          : "The gate will require a bdd_cmd to run the scenarios once a change is approved.",
        {
          file: "harness.config.yaml",
          fix: 'specgate config set bdd_cmd "<the command that runs the feature files, with {tags}>" — playwright-bdd: npx bddgen && npx playwright test --grep "{tags}"',
        }
      )
    );
  }
  for (const id of approved) {
    for (const f of changeFeatures(projectDir, id)) {
      const full = path.join(projectDir, f.file);
      if (!fs.existsSync(full)) {
        out.push(
          error("bdd_feature_missing", `${f.requirement} has no feature file: ${f.file}.`, {
            target: f.requirement,
            file: f.file,
            fix: `specgate change features ${id}`,
          })
        );
        continue;
      }
      const inFile = specgateTagsIn(fs.readFileSync(full, "utf8")).filter((t) => /^@SCN-/.test(t));
      const missing = f.scenarios.filter((t) => !inFile.includes(t));
      const extra = inFile.filter((t) => !f.scenarios.includes(t));
      if (missing.length || extra.length)
        out.push(
          error(
            "bdd_feature_stale",
            `${f.file} does not match ${f.requirement}'s scenarios` +
              (missing.length ? `: it lacks ${missing.join(", ")}` : "") +
              (extra.length
                ? `${missing.length ? ";" : ":"} it has ${extra.join(", ")} no more`
                : "") +
              ".",
            { target: f.requirement, file: f.file, fix: `specgate change features ${id}` }
          )
        );
    }
  }
  return out;
}

/** The command that runs a project's feature files, by its stack; null when it does not say (REQ-663). */
export function bddCommandFor(projectDir: string): string | null {
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(projectDir, rel), "utf8");
    } catch {
      return "";
    }
  };
  const packages = ["package.json"];
  for (const group of ["apps", "packages"]) {
    const dir = path.join(projectDir, group);
    if (fs.existsSync(dir))
      for (const d of fs.readdirSync(dir)) packages.push(path.join(group, d, "package.json"));
  }
  // The project's own script first: forja writes `test:bdd` (playwright-bdd) at the root.
  try {
    const scripts = (
      JSON.parse(read("package.json") || "{}") as { scripts?: Record<string, string> }
    ).scripts;
    if (scripts?.["test:bdd"]) return 'npm run test:bdd --silent -- --grep "{tags}"';
  } catch {
    // not JSON: the stack decides
  }
  if (packages.some((p) => /"@playwright\/test"|"playwright-bdd"/.test(read(p))))
    return 'npx bddgen && npx playwright test --grep "{tags}"';
  if (
    read("pom.xml") ||
    (fs.existsSync(path.join(projectDir, "apps")) &&
      fs
        .readdirSync(path.join(projectDir, "apps"))
        .some((d) => read(path.join("apps", d, "pom.xml"))))
  )
    return 'mvn -q test -Dcucumber.filter.tags="{tags}"';
  return null;
}

/** `bdd: required` written into gate.yaml, every other line kept (REQ-663). */
export function requireBdd(projectDir: string): boolean {
  const file = path.join(projectDir, GATE_POLICY_FILE);
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "preset: standard\n";
  if (/^bdd:\s*required\s*$/m.test(text)) return false;
  const next = /^bdd:.*$/m.test(text)
    ? text.replace(/^bdd:.*$/m, "bdd: required")
    : `${text.replace(/\s*$/, "")}\n# The scenarios are feature files a runner checks, before any code (REQ-661).\nbdd: required\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, "utf8");
  return true;
}

const BASELINE = "features/adoption/baseline.feature";
const BASELINE_SCENARIO = /^([ \t]*)Scenario: Existing test suite stays green[ \t\r]*$/m;

/**
 * Adoption's baseline scenario, when a feature runner would run it (REQ-822):
 * its steps belong to no runner — the test command the gate runs keeps its
 * promise — so with executable scenarios a full run fails on it.
 */
function baselineUnskipped(projectDir: string): string | null {
  const file = path.join(projectDir, BASELINE);
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const m = BASELINE_SCENARIO.exec(text);
  if (!m) return null;
  const before = text.slice(0, m.index).split("\n").slice(-3).join("\n");
  return /(^|\s)@skip\b/.test(before) ? null : text;
}

/** The baseline scenario tagged `@skip`, which playwright-bdd skips; true when it was written (REQ-822). */
export function skipAdoptionBaseline(projectDir: string): boolean {
  const text = baselineUnskipped(projectDir);
  if (text === null) return false;
  fs.writeFileSync(
    path.join(projectDir, BASELINE),
    text.replace(
      BASELINE_SCENARIO,
      (line, indent: string) =>
        `${indent}# Kept by the test command the gate runs, not by a feature runner.\n${indent}@skip\n${line}`
    ),
    "utf8"
  );
  return true;
}

/** Every approved open change's feature files written (REQ-663). */
export function syncApprovedChanges(projectDir: string): string[] {
  return openChanges(projectDir).flatMap((id) => syncIfApproved(projectDir, id));
}

/**
 * A feature file of a change still open (REQ-660): tagged `@change:<id>` and
 * that change not archived. Its row comes with the archive, so validate,
 * doctor, status and fix leave it out of the orphans.
 */
export function inOpenChange(projectDir: string, featurePath: string): boolean {
  let text = "";
  try {
    text = fs.readFileSync(path.resolve(projectDir, featurePath), "utf8");
  } catch {
    return false;
  }
  const id = /^@change:(\S+)/m.exec(text)?.[1];
  return !!id && fs.existsSync(path.join(projectDir, CHANGES, id));
}
