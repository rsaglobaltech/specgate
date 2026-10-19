/**
 * `projects:` fan-out, shared (E2-06 / issue #104).
 *
 * `specgate validate` has always fanned out over `specops.config.yaml`'s
 * `projects:` list (`ValidateSpecsCommand.ts`'s `validateMonorepo`) — a
 * monorepo declares its sibling project directories once, and `validate`
 * walks them. Measured before writing this: nothing else did. `plan`,
 * `status` and `report` only ever saw the root project, silently — a
 * two-project monorepo reported `requirements seen: 1`, not an error, just
 * wrong.
 *
 * This is that same pattern, extracted so a third and fourth command don't
 * each carry their own copy to drift from `validate`'s (the F1/A3 lesson,
 * applied again). Not a model change: each sub-project still answers for
 * itself via its own compiled script, run as a child process exactly as
 * `validate` already does it — this only removes the copy-paste.
 *
 * **Human output only**, matching the existing precedent: `validate`'s own
 * monorepo mode always prints prose, even under `--json` — it does not
 * aggregate child JSON documents into one. This does not attempt to solve
 * that either; it only extends the same behaviour to three more commands.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { findCliRoot } from "./project-root";

export interface MonorepoFanoutResult {
  failures: number;
}

/**
 * Runs `scriptName` once per `projects:` entry, in a child process, with
 * `extraArgs` plus `--project-dir <subDir>` appended. Returns `null` when
 * `targetDir` carries no `specops.config.yaml` or no `projects:` list — the
 * caller's cue to proceed with `targetDir` itself as a single project.
 */
export function runMonorepoFanout(
  targetDir: string,
  scriptName: string,
  extraArgs: string[] = []
): MonorepoFanoutResult | null {
  const cfgPath = path.join(targetDir, "specops.config.yaml");
  if (!fs.existsSync(cfgPath)) return null;
  let cfg: { projects?: unknown } | null;
  try {
    cfg = parseYamlLite(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    return null;
  }
  const projects = cfg && Array.isArray(cfg.projects) ? cfg.projects : null;
  if (!projects || projects.length === 0) return null;

  process.stdout.write(
    `🗂️ Monorepo: running ${scriptName} on ${projects.length} project(s) from specops.config.yaml\n`
  );
  const results: Array<{ project: string; ok: boolean; detail?: string }> = [];
  const root = findCliRoot(__dirname);

  for (const entry of projects) {
    const rel = typeof entry === "string" ? entry : entry && entry.path;
    if (!rel) {
      results.push({ project: String(entry), ok: false, detail: "invalid projects entry" });
      continue;
    }
    const subDir = path.join(targetDir, rel);
    process.stdout.write(`\n── ${rel} ──\n`);
    if (!fs.existsSync(subDir)) {
      process.stderr.write(`✖  Project directory not found: ${rel}\n`);
      process.stderr.write(
        `   fix: Fix the 'projects:' entry in specops.config.yaml or create ${rel}.\n`
      );
      results.push({ project: rel, ok: false, detail: "directory not found" });
      continue;
    }
    const scriptPath = fs.existsSync(path.join(root, "dist", "scripts", scriptName))
      ? path.join(root, "dist", "scripts", scriptName)
      : path.join(root, "scripts", scriptName);
    const args = [scriptPath, ...extraArgs, "--project-dir", subDir];
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
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
    `\n${failures.length === 0 ? "✅" : "❌"} ${results.length - failures.length}/${results.length} project(s) done\n`
  );
  return { failures: failures.length };
}
