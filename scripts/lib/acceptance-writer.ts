/**
 * sealed-acceptance REQ-761: the exam's level L3a — before the agent that
 * implements starts, another agent writes the acceptance tests, in a folder
 * that holds the specification and the design and no source. What it lists in
 * a change's `acceptance-tests.md` comes back to the project, and is sealed as a
 * person would seal it.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { acceptanceList, sealAcceptance } from "./acceptance";

/** What the writer sees: the contract and how the project runs its tests — never src/ or the tests already there. */
export const WRITER_PATHS = [
  "spec.md",
  "features",
  "docs/specs",
  "AGENTS.md",
  "README.md",
  "package.json",
  "harness.config.yaml",
];

/** The writer's folder: the paths above, copied from the project; nothing else. */
export function writerCopy(projectDir: string, writerDir: string): string[] {
  fs.mkdirSync(writerDir, { recursive: true });
  const copied: string[] = [];
  for (const p of WRITER_PATHS) {
    const from = path.join(projectDir, p);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(writerDir, p), { recursive: true });
    copied.push(p);
  }
  return copied;
}

const changeIds = (dir: string): string[] => {
  try {
    return fs
      .readdirSync(path.join(dir, "docs", "specs", "changes"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "archive")
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

/**
 * What the writer listed comes back: each change's `acceptance-tests.md` and the
 * files it names, inside the project, outside `src/`. Then each is sealed.
 */
export function takeAcceptance(
  writerDir: string,
  projectDir: string,
  today: string
): { ok: true; sealed: string[] } | { ok: false; reason: string } {
  const sealed: string[] = [];
  for (const id of changeIds(writerDir)) {
    const list = acceptanceList(writerDir, id);
    if (!list || list.length === 0) continue;
    for (const line of list) {
      const rel = path.normalize(line.path);
      if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep)[0] === "src")
        return {
          ok: false,
          reason: `the writer listed ${line.path}, which is not a test it may write`,
        };
      const from = path.join(writerDir, rel);
      if (!fs.existsSync(from))
        return { ok: false, reason: `the writer listed ${line.path} and did not write it` };
      fs.mkdirSync(path.dirname(path.join(projectDir, rel)), { recursive: true });
      fs.copyFileSync(from, path.join(projectDir, rel));
    }
    const doc = path.join("docs", "specs", "changes", id, "acceptance-tests.md");
    fs.copyFileSync(path.join(writerDir, doc), path.join(projectDir, doc));
    const r = sealAcceptance(projectDir, id, today, {
      name: "exam (as the person)",
      email: "exam@specgate.invalid",
    });
    if (!r.ok) return { ok: false, reason: `the writer's tests could not be sealed: ${r.message}` };
    sealed.push(...r.sealed);
  }
  return sealed.length
    ? { ok: true, sealed }
    : { ok: false, reason: "the writer listed no acceptance test" };
}
