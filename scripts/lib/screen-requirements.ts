import * as fs from "node:fs";
import * as path from "node:path";
import { actorSurfaces } from "../../packages/core/src/domain/DraftChecklist";

/**
 * Which requirements are used on a screen, and whether an end-to-end test
 * names them (REQ-199). Twenty requirements of the form "WHEN the user taps
 * …, THEN they see …" passed the harness with a use case and a unit test and
 * no screen at all; with `e2e_dir` set, the gate asks for the e2e test.
 */

/** The surfaces that are a screen someone looks at. */
export const SCREEN_SURFACES = new Set(["web", "mobile", "tablet", "desktop"]);

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function specFiles(dir: string): string[] {
  const out = [path.join(dir, "spec.md")];
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && e.name !== "archive") walk(full);
      else if (e.name === "spec.md") out.push(full);
    }
  };
  walk(path.join(dir, "docs", "specs"));
  return out;
}

/** The trace comment of a requirement, wherever the project defines it. */
function traceOf(dir: string, id: string): string {
  const head = new RegExp(`^(?:###\\s+Requirement:|#{2,3})\\s+${id}\\b`);
  for (const file of specFiles(dir)) {
    const lines = read(file).split(/\r?\n/);
    const at = lines.findIndex((l) => head.test(l));
    if (at === -1) continue;
    for (let i = at + 1; i < lines.length && !/^#{2,3}\s(?!#)/.test(lines[i]); i += 1) {
      if (/<!--\s*specgate:trace\b/.test(lines[i])) return lines[i];
    }
    return "";
  }
  return "";
}

function field(trace: string, name: string): string {
  const m = new RegExp(`\\b${name}=(?:"([^"]*)"|([^\\s"]+?))(?=\\s|-->)`).exec(trace);
  return m ? m[1] || m[2] || "" : "";
}

/**
 * The surfaces a requirement is used on: its own `surfaces=`, else its actor's
 * in the brief's front matter. Empty when neither says.
 */
export function requirementSurfaces(dir: string, id: string): string[] {
  const trace = traceOf(dir, id);
  const own = field(trace, "surfaces");
  if (own) return own.split(/[,\s]+/).filter(Boolean);
  const actor = field(trace, "actor").toLowerCase();
  if (!actor) return [];
  for (const rel of [path.join("docs", "brief.md"), "brief.md"]) {
    const brief = read(path.join(dir, rel));
    if (brief) return actorSurfaces(brief).get(actor) || [];
  }
  return [];
}

/** Whether the requirement is used on a screen. */
export function onScreen(dir: string, id: string): boolean {
  return requirementSurfaces(dir, id).some((s) => SCREEN_SURFACES.has(s.toLowerCase()));
}

/** The files under the e2e folder whose name or content names the requirement. */
export function e2eTestsNaming(dir: string, e2eDir: string, id: string): string[] {
  const named = new RegExp(`(^|[^\\w-])${id}(?!\\d)`);
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(full);
      } else if (named.test(e.name) || named.test(read(full))) {
        out.push(path.relative(dir, full).split(path.sep).join("/"));
      }
    }
  };
  walk(path.join(dir, e2eDir));
  return out;
}
