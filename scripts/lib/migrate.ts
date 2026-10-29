/**
 * `specgate migrate 1.0` (REQ-325..329): what moves a 0.27 project to 1.0.
 *
 * The migration is a table of steps. Each step only *plans*: it returns the
 * file actions it needs and what a person must still do by hand. One function
 * applies the actions, so a preview (`--dry-run`) and a real run report the
 * same thing, and a later 1.0 feature adds its step by appending to
 * `MIGRATION_1_0` — nothing else.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CHANGE_CONFIG_FILE,
  listChangeIds,
  paths,
  readConfig,
} from "../../packages/core/src/infrastructure/ChangeWorkspace";
import {
  LAYERED_SCHEMA,
  LEGACY_DISCOVER,
  designFromProposal,
  layer,
  templateDraftTasks,
  templateLayeredTasks,
} from "../../packages/core/src/domain/ChangeLayers";

/** Where the report of a real run is written, relative to the project. */
export const MIGRATION_REPORT = path.join("docs", "specs", "migration-1.0.md");

/** One file operation a step needs. `file` is relative to the project. */
export type MigrationAction =
  | { kind: "write"; file: string; content: string; why: string }
  | { kind: "rename"; file: string; from: string; why: string }
  | { kind: "edit"; file: string; content: string; why: string };

export interface StepPlan {
  actions: MigrationAction[];
  /** What a person must still do, one sentence each. */
  manual: string[];
}

export interface MigrationStep {
  id: string;
  title: string;
  plan(projectDir: string): StepPlan;
}

const rel = (...parts: string[]) => path.join(...parts);

/**
 * The open changes still written for 0.27: their `change.yaml` says (or
 * defaults to) `spec-driven`. The archive is never listed (REQ-325).
 */
export function changesToMigrate(projectDir: string): string[] {
  return listChangeIds(projectDir).filter((id) => {
    try {
      return readConfig(projectDir, id).schema === "spec-driven";
    } catch {
      return false;
    }
  });
}

/** `change.yaml` with its schema set to `layered`, every other line kept. */
function layeredConfig(file: string): string {
  if (!fs.existsSync(file)) return `specgate_change_version: 1\nschema: ${LAYERED_SCHEMA}\n`;
  const text = fs.readFileSync(file, "utf8");
  if (/^schema:.*$/m.test(text)) return text.replace(/^schema:.*$/m, `schema: ${LAYERED_SCHEMA}`);
  const end = text.endsWith("\n") || text === "" ? "" : "\n";
  return `${text}${end}schema: ${LAYERED_SCHEMA}\n`;
}

/** REQ-325: each open 0.27 change, in the three layers of ADR-0042. */
const layersStep: MigrationStep = {
  id: "layers",
  title: "Open changes in three layers: discover.md, design.md, tasks.md",
  plan(projectDir) {
    const actions: MigrationAction[] = [];
    const manual: string[] = [];
    const root = paths(projectDir).root;
    for (const id of changesToMigrate(projectDir)) {
      const dir = rel("docs", "specs", "changes", id);
      const abs = (f: string) => path.join(root, dir, f);
      const discover = layer("discover").file;
      const proposalText = fs.existsSync(abs(LEGACY_DISCOVER))
        ? fs.readFileSync(abs(LEGACY_DISCOVER), "utf8")
        : "";
      if (proposalText && !fs.existsSync(abs(discover))) {
        actions.push({
          kind: "rename",
          from: rel(dir, LEGACY_DISCOVER),
          file: rel(dir, discover),
          why: "the proposal is the Discover, word for word",
        });
      }
      if (!fs.existsSync(abs(layer("design").file))) {
        actions.push({
          kind: "write",
          file: rel(dir, layer("design").file),
          content: designFromProposal(proposalText, id),
          why: "a first design, drafted from the proposal",
        });
        manual.push(
          `Review ${rel(dir, layer("design").file)}: the architect answers each acceptance criterion (AC-1…) there.`
        );
      }
      if (!fs.existsSync(abs(layer("tasks").file))) {
        // A draft from a brief has no work to tick until it is reviewed.
        const draft = fs.existsSync(abs("DRAFTING.md"));
        actions.push({
          kind: "write",
          file: rel(dir, layer("tasks").file),
          content: draft ? templateDraftTasks() : templateLayeredTasks(),
          why: "the developer's layer",
        });
      }
      actions.push({
        kind: "edit",
        file: rel(dir, CHANGE_CONFIG_FILE),
        content: layeredConfig(abs(CHANGE_CONFIG_FILE)),
        why: `schema: ${LAYERED_SCHEMA}`,
      });
      manual.push(
        `Run specgate change validate ${id}: a 0.27 proposal often names technology the Discover should leave to the design.`
      );
    }
    return { actions, manual };
  },
};

/**
 * The configuration files whose version 1.0 moves, and to what. None has
 * changed yet; a 1.0 feature that bumps one adds its row here.
 */
export const CONFIG_VERSIONS: ReadonlyArray<{ file: string; key: string; target: number }> = [
  { file: "harness.config.yaml", key: "harness_version", target: 1 },
];

const configStep: MigrationStep = {
  id: "config",
  title: "Configuration versions",
  plan(projectDir) {
    const actions: MigrationAction[] = [];
    for (const v of CONFIG_VERSIONS) {
      const file = path.join(projectDir, v.file);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      const m = new RegExp(`^${v.key}:\\s*(\\d+)\\s*$`, "m").exec(text);
      if (m && Number(m[1]) < v.target) {
        actions.push({
          kind: "edit",
          file: v.file,
          content: text.replace(m[0], `${v.key}: ${v.target}`),
          why: `${v.key} ${m[1]} → ${v.target}`,
        });
      }
    }
    return { actions, manual: [] };
  },
};

/** The 1.0 migration, in order. A later 1.0 step is appended here. */
export const MIGRATION_1_0: MigrationStep[] = [layersStep, configStep];

export interface PlannedStep extends StepPlan {
  id: string;
  title: string;
}

export function planMigration(
  projectDir: string,
  steps: MigrationStep[] = MIGRATION_1_0
): PlannedStep[] {
  return steps.map((s) => ({ id: s.id, title: s.title, ...s.plan(projectDir) }));
}

/** Carry out every action of every step, in order. */
export function applyMigration(projectDir: string, planned: PlannedStep[]): number {
  let n = 0;
  for (const step of planned) {
    for (const a of step.actions) {
      const target = path.join(projectDir, a.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (a.kind === "rename") fs.renameSync(path.join(projectDir, a.from), target);
      else fs.writeFileSync(target, a.content, "utf8");
      n += 1;
    }
  }
  return n;
}

/** Why the migration cannot start here, or null: it starts from a commit (REQ-327). */
export function dirtyTreeProblem(projectDir: string): "not-git" | "dirty" | null {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return "not-git";
  const st = spawnSync("git", ["status", "--porcelain", "--", "."], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return st.status === 0 && st.stdout.trim() === "" ? null : "dirty";
}

/** One action in a sentence: "moved …" for the report, "move …" for a preview. */
const describe = (a: MigrationAction, tense: "done" | "planned" = "done") => {
  const verb = {
    rename: tense === "done" ? "moved" : "move",
    write: tense === "done" ? "wrote" : "write",
    edit: tense === "done" ? "updated" : "update",
  }[a.kind];
  return a.kind === "rename"
    ? `${verb} \`${slash(a.from)}\` to \`${slash(a.file)}\` (${a.why})`
    : `${verb} \`${slash(a.file)}\` (${a.why})`;
};

const slash = (p: string) => p.split(path.sep).join("/");

/** The report a person keeps: what was done, what is left (REQ-328). */
export function renderReport(planned: PlannedStep[], date: string): string {
  const out = [
    "# Migration to Specgate 1.0",
    "",
    `Written by \`specgate migrate 1.0\` on ${date}. What it did, and what is still yours to do.`,
    "",
  ];
  for (const s of planned) {
    out.push(`## ${s.title}`, "");
    if (s.actions.length === 0) out.push("Nothing to change.", "");
    else out.push(...s.actions.map((a) => `- ${describe(a)}`), "");
  }
  const manual = planned.flatMap((s) => s.manual);
  out.push("## Still to do", "");
  out.push(...(manual.length ? manual.map((m) => `- ${slash(m)}`) : ["Nothing."]), "");
  return out.join("\n");
}

/** The JSON form of an action, with forward slashes on every OS. */
export function actionJson(a: MigrationAction): Record<string, string> {
  return {
    kind: a.kind,
    file: slash(a.file),
    ...(a.kind === "rename" ? { from: slash(a.from) } : {}),
    why: a.why,
  };
}

export { describe as describeAction };
