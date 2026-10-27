import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { requirementDetail } from "./live-detail";
import { listChangeIds, listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";

/**
 * What a change to a requirement touches (REQ-191): where it is defined, its
 * features, the tests that name it, the files its commits changed, and the
 * requirements whose text names it.
 */

export interface Impact {
  requirement: string;
  spec: { file: string; line: number } | null;
  features: string[];
  tests: string[];
  files: string[];
  namedBy: string[];
}

const HEADING = /^(?:###\s+Requirement:|#{2,3})\s+(REQ-\d+)\b/;

function specFiles(projectDir: string): string[] {
  const out: string[] = [];
  const spec = path.join(projectDir, "spec.md");
  if (fs.existsSync(spec)) out.push(spec);
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "archive") walk(full);
      else if (e.name === "spec.md") out.push(full);
    }
  };
  walk(path.join(projectDir, "docs", "specs"));
  return out;
}

/** The requirements whose statement or scenarios name `id`, other than itself. */
function namedBy(projectDir: string, id: string): string[] {
  const found = new Set<string>();
  const named = new RegExp(`(^|[^\\w-])${id}(?!\\d)`);
  for (const file of specFiles(projectDir)) {
    let current: string | null = null;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const h = HEADING.exec(line);
      if (h) {
        current = h[1];
        continue;
      }
      if (current && current !== id && !line.includes("specgate:trace") && named.test(line)) {
        found.add(current);
      }
    }
  }
  return [...found].sort();
}

/** The files the commits naming `id` changed, outside the specification. */
function filesOf(projectDir: string, id: string): string[] {
  const r = spawnSync("git", ["log", "-E", `--grep=${id}([^0-9]|$)`, "--name-only", "--format="], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return [];
  return [
    ...new Set(
      r.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((f) => !/^(docs\/specs\/|features\/|spec\.md$)/.test(f))
    ),
  ].sort();
}

/** Feature files named after the requirement, as `archive` writes them: features/<area>/<REQ>.feature. */
function featuresNamed(projectDir: string, id: string): string[] {
  const out: string[] = [];
  const root = path.join(projectDir, "features");
  let areas: fs.Dirent[] = [];
  try {
    areas = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const a of areas) {
    if (a.isDirectory() && fs.existsSync(path.join(root, a.name, `${id}.feature`))) {
      out.push(`features/${a.name}/${id}.feature`);
    }
  }
  return out;
}

export function requirementImpact(projectDir: string, id: string): Impact {
  const d = requirementDetail(projectDir, id) as {
    source?: { file: string; line: number } | null;
    features?: string[];
    tests?: string[];
  };
  return {
    requirement: id,
    spec: d.source || null,
    features: [...new Set([...(d.features || []), ...featuresNamed(projectDir, id)])].sort(),
    tests: d.tests || [],
    files: filesOf(projectDir, id),
    namedBy: namedBy(projectDir, id),
  };
}

/** The requirements a change modifies or removes, in id order. */
export function changedBy(projectDir: string, change: string): string[] {
  const ids = new Set<string>();
  for (const d of listDeltas(projectDir, change)) {
    const text = fs.readFileSync(d.file, "utf8");
    for (const section of text.split(/^## /m)) {
      if (!/^(MODIFIED|REMOVED|RENAMED) Requirements/.test(section)) continue;
      for (const m of section.matchAll(/^###\s+Requirement:\s+(REQ-\d+)/gm)) ids.add(m[1]);
    }
  }
  return [...ids].sort();
}

/** The impact of a requirement, or of each requirement a change modifies or removes. */
export function impactOf(projectDir: string, target: string): Impact[] | null {
  if (/^REQ-\d+$/.test(target)) return [requirementImpact(projectDir, target)];
  if (!listChangeIds(projectDir).includes(target)) return null;
  return changedBy(projectDir, target).map((id) => requirementImpact(projectDir, id));
}
