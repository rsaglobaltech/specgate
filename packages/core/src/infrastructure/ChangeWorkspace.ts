/**
 * Layout and metadata for the change lifecycle.
 *
 * Everything the lifecycle owns lives under `docs/specs/`, next to the
 * artefacts that were already there. A project generated before this feature
 * simply has no `changes/` directory, and every command below degrades to
 * "nothing to do" rather than failing — that is the retro-compatibility
 * contract, and there is a test for it.
 *
 *   docs/specs/
 *   ├── capabilities/<cap>/spec.md              ← source of truth
 *   ├── changes/<id>/
 *   │   ├── proposal.md · design.md · tasks.md
 *   │   ├── change.yaml
 *   │   ├── specs/<cap>/spec.md                 ← delta
 *   │   └── features/<module>/<name>.feature    ← proposed Gherkin (ours)
 *   └── changes/archive/YYYY-MM-DD-<id>/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../domain/YamlLite";

export const SPECS_DIR = path.join("docs", "specs");
export const CAPABILITIES_DIR = path.join(SPECS_DIR, "capabilities");
export const CHANGES_DIR = path.join(SPECS_DIR, "changes");
export const ARCHIVE_DIR = path.join(CHANGES_DIR, "archive");
export const TRACEABILITY_FILE = path.join(SPECS_DIR, "traceability.md");

export const CHANGE_CONFIG_FILE = "change.yaml";
export const CHANGE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_CONFIG = Object.freeze({
  specgate_change_version: 1,
  schema: "spec-driven",
  rigor: "lite",
  skip_specs: false,
  retire_capabilities: false,
});

export function paths(projectDir) {
  const root = path.resolve(projectDir);
  return {
    root,
    specs: path.join(root, SPECS_DIR),
    capabilities: path.join(root, CAPABILITIES_DIR),
    changes: path.join(root, CHANGES_DIR),
    archive: path.join(root, ARCHIVE_DIR),
    traceability: path.join(root, TRACEABILITY_FILE),
    change: (id) => path.join(root, CHANGES_DIR, id),
    changeSpecs: (id) => path.join(root, CHANGES_DIR, id, "specs"),
    changeFeatures: (id) => path.join(root, CHANGES_DIR, id, "features"),
    capabilitySpec: (cap) => path.join(root, CAPABILITIES_DIR, cap, "spec.md"),
  };
}

/** Active changes, sorted. `archive` is never an active change. */
export function listChangeIds(projectDir) {
  const p = paths(projectDir);
  if (!fs.existsSync(p.changes)) return [];
  return fs
    .readdirSync(p.changes, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "archive")
    .map((e) => e.name)
    .sort();
}

export function listArchivedIds(projectDir) {
  const p = paths(projectDir);
  if (!fs.existsSync(p.archive)) return [];
  return fs
    .readdirSync(p.archive, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * Every delta file inside a change, keyed by the capability it targets.
 * `docs/specs/changes/<id>/specs/pricing/spec.md` → capability "pricing".
 * Nested capability names (`billing/invoicing`) are supported.
 */
export function listDeltas(projectDir, changeId) {
  const base = paths(projectDir).changeSpecs(changeId);
  const out = [];
  if (!fs.existsSync(base)) return out;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "spec.md") {
        out.push({
          capability: path.relative(base, path.dirname(full)).split(path.sep).join("/"),
          file: full,
          relative: path.relative(paths(projectDir).root, full).split(path.sep).join("/"),
        });
      }
    }
  };
  walk(base);
  return out.sort((a, b) => a.capability.localeCompare(b.capability));
}

/** Proposed `.feature` files a change carries, relative to its features/ dir. */
export function listChangeFeatures(projectDir, changeId) {
  const base = paths(projectDir).changeFeatures(changeId);
  const out = [];
  if (!fs.existsSync(base)) return out;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".feature")) {
        out.push({
          file: full,
          relative: path.relative(base, full).split(path.sep).join("/"),
        });
      }
    }
  };
  walk(base);
  return out.sort((a, b) => a.relative.localeCompare(b.relative));
}

export function readConfig(projectDir, changeId) {
  const file = path.join(paths(projectDir).change(changeId), CHANGE_CONFIG_FILE);
  if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG };
  let parsed;
  try {
    parsed = parseYamlLite(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(
      `${CHANGE_CONFIG_FILE} of change "${changeId}" is not valid YAML: ${err.message}`
    );
  }
  return { ...DEFAULT_CONFIG, ...(parsed || {}) };
}

export function renderConfig(cfg) {
  const lines = [
    `specgate_change_version: ${cfg.specgate_change_version || 1}`,
    `schema: ${cfg.schema || "spec-driven"}`,
    `created: ${cfg.created}`,
    `rigor: ${cfg.rigor || "lite"}`,
    `skip_specs: ${cfg.skip_specs === true}`,
    `retire_capabilities: ${cfg.retire_capabilities === true}`,
  ];
  if (Array.isArray(cfg.req_range) && cfg.req_range.length === 2) {
    lines.push(`req_range: [${cfg.req_range[0]}, ${cfg.req_range[1]}]`);
  }
  return `${lines.join("\n")}\n`;
}

// ── REQ id allocation ─────────────────────────────────────────────────────────

const REQ_ID_RE = /\bREQ-(\d+)\b/g;

/**
 * The highest REQ number already spoken for anywhere in the project: the
 * traceability matrix, the capability specs, and every other change's reserved
 * range — including archived ones, because ids must never be recycled.
 *
 * Two changes worked in parallel would otherwise both mint REQ-014.
 */
export function highestReservedReq(projectDir) {
  const p = paths(projectDir);
  let max = 0;
  const scan = (text) => {
    let m;
    REQ_ID_RE.lastIndex = 0;
    while ((m = REQ_ID_RE.exec(String(text))) !== null) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  };

  if (fs.existsSync(p.traceability)) scan(fs.readFileSync(p.traceability, "utf8"));

  const walkSpecs = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSpecs(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) scan(fs.readFileSync(full, "utf8"));
    }
  };
  walkSpecs(p.capabilities);

  for (const id of [...listChangeIds(projectDir), ...listArchivedIds(projectDir)]) {
    const dir = fs.existsSync(p.change(id)) ? p.change(id) : path.join(p.archive, id);
    const cfgFile = path.join(dir, CHANGE_CONFIG_FILE);
    if (fs.existsSync(cfgFile)) scan(fs.readFileSync(cfgFile, "utf8"));
    walkSpecs(path.join(dir, "specs"));
  }

  return max;
}

export function formatReqId(n) {
  return `REQ-${String(n).padStart(3, "0")}`;
}

/** Reserve `count` consecutive REQ ids for a new change. */
export function reserveReqRange(projectDir, count) {
  const start = highestReservedReq(projectDir) + 1;
  const end = start + Math.max(1, count) - 1;
  return [formatReqId(start), formatReqId(end)];
}

// ── Task progress ─────────────────────────────────────────────────────────────

const TASK_LINE = /^[ \t]*[-*][ \t]\[( |x|X)\][ \t](.*)$/;

export function parseTasks(markdown) {
  const tasks = [];
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const m = TASK_LINE.exec(line);
    if (m) tasks.push({ done: m[1].toLowerCase() === "x", description: m[2].trim() });
  }
  return tasks;
}

export function taskProgress(projectDir, changeId) {
  const file = path.join(paths(projectDir).change(changeId), "tasks.md");
  if (!fs.existsSync(file)) return { total: 0, complete: 0, remaining: 0, tasks: [] };
  const tasks = parseTasks(fs.readFileSync(file, "utf8"));
  const complete = tasks.filter((t) => t.done).length;
  return { total: tasks.length, complete, remaining: tasks.length - complete, tasks };
}

export function changeStatusLabel(progress) {
  if (progress.total === 0) return "no-tasks";
  if (progress.remaining === 0) return "complete";
  return "in-progress";
}
