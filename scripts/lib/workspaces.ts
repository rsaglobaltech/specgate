/**
 * The workspaces a project declares (REQ-809, REQ-810): `workspaces` in the
 * root `package.json`, an array or `{ packages }`, each entry a folder or a
 * folder ending in `/*`. Returns the folders that exist, relative to the
 * project, with `/` separators.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export function workspaceDirs(projectDir: string): string[] {
  let declared: unknown;
  try {
    declared = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf8")
    ).workspaces;
  } catch {
    return [];
  }
  const entries = Array.isArray(declared)
    ? declared
    : Array.isArray((declared as { packages?: unknown })?.packages)
      ? (declared as { packages: unknown[] }).packages
      : [];
  const out: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const rel = entry.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    if (rel.endsWith("/*")) {
      const parent = rel.slice(0, -2);
      let names: fs.Dirent[] = [];
      try {
        names = fs.readdirSync(path.join(projectDir, parent), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const n of names) if (n.isDirectory()) out.push(`${parent}/${n.name}`);
    } else if (!rel.includes("*") && fs.existsSync(path.join(projectDir, rel))) {
      out.push(rel);
    }
  }
  return [...new Set(out)].sort();
}
