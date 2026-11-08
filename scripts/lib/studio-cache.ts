import * as fs from "node:fs";
import * as path from "node:path";

/**
 * What the studio reads, kept until a spec file changes (REQ-430). Every
 * five-second refresh used to start `specgate status` in a new process — seconds
 * on Windows, and the single-threaded server answered nothing meanwhile.
 */

/** The folders and files a project's state is read from. */
const SOURCES = ["spec.md", path.join("docs", "specs"), "features", path.join(".harness", "runs")];

/** Each source file's path, size and modification time, in a stable order: a change to any changes it. */
export function specSignature(projectDir: string): string {
  const parts: string[] = [];
  const visit = (abs: string) => {
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      let names: string[] = [];
      try {
        names = fs.readdirSync(abs).sort();
      } catch {
        return;
      }
      for (const n of names) visit(path.join(abs, n));
      return;
    }
    parts.push(`${path.relative(projectDir, abs)}:${st.size}:${st.mtimeMs}`);
  };
  for (const s of SOURCES) visit(path.join(projectDir, s));
  return parts.join("\n");
}

const cache = new Map<string, { signature: string; value: unknown }>();

/** `compute()`'s value, reused while the project's spec files are as they were. */
export function cachedBySpecs<T>(projectDir: string, key: string, compute: () => T): T {
  const id = `${path.resolve(projectDir)}::${key}`;
  const signature = specSignature(projectDir);
  const hit = cache.get(id);
  if (hit && hit.signature === signature) return hit.value as T;
  const value = compute();
  cache.set(id, { signature, value });
  return value;
}
