/**
 * What the agent guards need to know about a project, read from its files.
 *
 * The hooks run on every session start and every edit, so they read
 * `docs/specs/changes/` themselves rather than spawning the CLI: a guard that
 * costs a second per edit gets switched off. Like every plugin script, this
 * file imports nothing but Node's own modules — it is copied into the plugin
 * and has to work on a machine where the CLI is not installed.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** An open change and its requirements, in the order its deltas declare them. */
export interface OpenChange {
  id: string;
  requirements: string[];
  /** Those not yet Implemented (or later). */
  pending: string[];
}

/** Statuses that mean a requirement is delivered. */
const DONE = new Set(["Implemented", "Verified", "Released", "Deprecated"]);

/** Is this folder a spec-driven project? The same test the gate hook makes. */
export function isSpecDriven(root: string): boolean {
  return fs.existsSync(path.join(root, "spec.md"));
}

/** Every `spec.md` under a folder, in a stable order. */
function deltaFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...deltaFiles(full));
    else if (entry.name === "spec.md") out.push(full);
  }
  return out.sort();
}

/** The requirements a delta declares, each with the status of its trace comment. */
export function deltaRequirements(text: string): { id: string; status: string }[] {
  const out: { id: string; status: string }[] = [];
  for (const block of text.split(/^(?=### Requirement: )/m)) {
    const id = /^### Requirement: (REQ-\d+)/.exec(block)?.[1];
    if (!id) continue;
    const status = /<!--\s*specgate:trace[^>]*\bstatus=([A-Za-z]+(?: [A-Za-z]+)*?)(?=\s+\w+=|\s*-->)/.exec(
      block
    )?.[1];
    out.push({ id, status: status ?? "Draft" });
  }
  return out;
}

/** The changes open under `docs/specs/changes/`, the archive left out. */
export function openChanges(root: string): OpenChange[] {
  const dir = path.join(root, "docs", "specs", "changes");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "archive")
    .map((e) => e.name)
    .sort()
    .map((id) => {
      const reqs = deltaFiles(path.join(dir, id, "specs")).flatMap((f) =>
        deltaRequirements(fs.readFileSync(f, "utf8"))
      );
      return {
        id,
        requirements: reqs.map((r) => r.id),
        pending: reqs.filter((r) => !DONE.has(r.status)).map((r) => r.id),
      };
    });
}
