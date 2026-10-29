/**
 * The organization's principles as `check` sees them (REQ-330..332): the
 * version this repository follows, whether its source has a newer one, and the
 * principles' machine checks.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { error, warning, type Diagnostic } from "./diagnostics";
import { forShell } from "./shell-command";
import {
  PRINCIPLES_FILE,
  compareVersions,
  globToRegExp,
  parsePrinciples,
  type PrinciplesDoc,
} from "../../packages/core/src/domain/Principles";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { readLock } from "../specops/lock";

export interface SteeringResult {
  /** Null when the repository has no principles file. */
  principles: { version: string; source: string; checked: number } | null;
  findings: Diagnostic[];
}

/** The version a pack's source declares, when the source is a local folder. */
function packVersion(projectDir: string, packId: string): string | null {
  let lock;
  try {
    lock = readLock(projectDir);
  } catch {
    return null;
  }
  const entry = lock?.packs.find((p) => p.pack_id === packId);
  if (!entry) return null;
  const repo = path.resolve(projectDir, String(entry.repo || ""));
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) return null;
  const candidates = [entry.pack, entry.pack_id, ""].filter((x) => x !== undefined);
  for (const sub of candidates) {
    const file = path.join(repo, String(sub), "pack.yaml");
    if (!fs.existsSync(file)) continue;
    try {
      const meta = parseYamlLite(fs.readFileSync(file, "utf8")).metadata as
        Record<string, unknown> | undefined;
      if (meta && meta.version) return String(meta.version);
    } catch {
      return null;
    }
  }
  return null;
}

/** The version the source offers, and how to take it; null when unknown. */
function upstream(
  projectDir: string,
  doc: PrinciplesDoc
): { version: string; update: string } | null {
  if (!doc.source) return null;
  if (doc.source.startsWith("pack:")) {
    const id = doc.source.slice("pack:".length).trim();
    const version = packVersion(projectDir, id);
    return version ? { version, update: `specgate specops sync --pack ${id}` } : null;
  }
  const file = path.resolve(projectDir, doc.source);
  if (!fs.existsSync(file)) return null;
  const version = parsePrinciples(fs.readFileSync(file, "utf8")).version;
  return version
    ? { version, update: `copy ${doc.source} over ${PRINCIPLES_FILE}, and review what changed` }
    : null;
}

/** Files a pattern principle reads: tracked ones, or every file without git. */
function projectFiles(projectDir: string): string[] {
  const r = spawnSync("git", ["-C", projectDir, "ls-files"], { encoding: "utf8" });
  if (r.status === 0) return (r.stdout || "").split("\n").filter(Boolean);
  const out: string[] = [];
  const skip = new Set([".git", "node_modules", "dist", "target", "build"]);
  const walk = (rel: string) => {
    for (const e of fs.readdirSync(path.join(projectDir, rel), { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk("");
  return out;
}

export function steering(projectDir: string): SteeringResult {
  const file = path.join(projectDir, PRINCIPLES_FILE);
  if (!fs.existsSync(file)) return { principles: null, findings: [] };
  const doc = parsePrinciples(fs.readFileSync(file, "utf8"));
  const findings: Diagnostic[] = [];

  const up = upstream(projectDir, doc);
  if (up && doc.version && compareVersions(up.version, doc.version) > 0) {
    findings.push(
      warning(
        "principles_behind",
        `This repository follows the principles ${doc.version}; ${doc.source} has ${up.version}.`,
        { target: PRINCIPLES_FILE, fix: up.update }
      )
    );
  }

  let files: string[] | null = null;
  let checked = 0;
  for (const p of doc.principles) {
    const make = p.level === "warn" ? warning : error;
    if (p.run) {
      checked++;
      const r = spawnSync(forShell(p.run), { cwd: projectDir, shell: true, encoding: "utf8" });
      if (r.status !== 0) {
        findings.push(
          make(
            "principle_failed",
            `Principle ${p.id} (${p.title}): \`${p.run}\` exited ${r.status}.`,
            {
              target: p.id,
              fix: `Make \`${p.run}\` pass, or change ${p.id} in ${PRINCIPLES_FILE} on purpose.`,
            }
          )
        );
      }
    }
    if (p.forbid) {
      checked++;
      let pattern: RegExp;
      try {
        pattern = new RegExp(p.forbid);
      } catch {
        findings.push(
          error(
            "principle_invalid",
            `Principle ${p.id}: forbid is not a valid pattern: ${p.forbid}`,
            {
              target: p.id,
            }
          )
        );
        continue;
      }
      files = files || projectFiles(projectDir);
      const scope = p.in ? globToRegExp(p.in) : null;
      const hits: string[] = [];
      for (const f of files) {
        if (f === PRINCIPLES_FILE || (scope && !scope.test(f))) continue;
        let text: string;
        try {
          text = fs.readFileSync(path.join(projectDir, f), "utf8");
        } catch {
          continue;
        }
        text.split(/\r?\n/).forEach((line, i) => {
          if (pattern.test(line)) hits.push(`${f}:${i + 1}`);
        });
      }
      if (hits.length > 0) {
        findings.push(
          make(
            "principle_failed",
            `Principle ${p.id} (${p.title}): forbidden in ${hits.slice(0, 5).join(", ")}${hits.length > 5 ? ` and ${hits.length - 5} more` : ""}.`,
            { target: p.id, fix: `Remove it, or change ${p.id} in ${PRINCIPLES_FILE} on purpose.` }
          )
        );
      }
    }
  }
  return { principles: { version: doc.version, source: doc.source, checked }, findings };
}
