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
import { spawnSync } from "node:child_process";

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
    const status =
      /<!--\s*specgate:trace[^>]*\bstatus=([A-Za-z]+(?: [A-Za-z]+)*?)(?=\s+\w+=|\s*-->)/.exec(
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

/** Is the guard turned off — by `SPECGATE_GUARD=off`, or `agent_guard: off` in `.specgate/config.json`? */
export function guardOff(root: string, env: Record<string, string | undefined>): boolean {
  if ((env.SPECGATE_GUARD ?? "").toLowerCase() === "off") return true;
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, ".specgate", "config.json"), "utf8"));
    return String(config.agent_guard ?? "").toLowerCase() === "off";
  } catch {
    return false;
  }
}

/** Files a test runner picks up, in the conventions of the stacks Specgate serves. */
export function isTestFile(rel: string): boolean {
  const p = rel.replace(/\\/g, "/");
  const name = p.slice(p.lastIndexOf("/") + 1);
  return (
    /(^|\/)(tests?|__tests__|spec|e2e)\//.test(p) ||
    /\.(test|spec|e2e)\.[cm]?[jt]sx?$/.test(name) ||
    /(Test|Tests|IT|TestCase|Spec)\.(java|kt|scala|groovy|cs)$/.test(name) ||
    /^test_.*\.py$|_test\.py$/.test(name) ||
    /_test\.go$/.test(name) ||
    /_spec\.rb$/.test(name) ||
    /\.feature$/.test(name)
  );
}

/** Code the guard holds back until a test names the requirement: these extensions, outside the docs. */
const SOURCE =
  /\.([cm]?[jt]sx?|java|kt|kts|scala|groovy|py|go|rb|cs|php|rs|swift|c|cc|cpp|h|hpp|vue|svelte)$/;

/** Does an edit to `rel` (from the project root) wait for a test? */
export function needsTest(rel: string): boolean {
  const p = rel.replace(/\\/g, "/");
  if (p === "spec.md" || /^(features|docs)\//.test(p) || /(^|\/)\./.test(p)) return false;
  return SOURCE.test(p) && !isTestFile(p);
}

/**
 * The files new or modified in the working tree, from the project root — or
 * null when git cannot say (no repository, no git), and the guard stands aside.
 */
export function changedFiles(root: string): string[] | null {
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "-z"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (r.error || r.status !== 0) return null;
  const prefix = spawnSync("git", ["rev-parse", "--show-prefix"], { cwd: root, encoding: "utf8" });
  const under = prefix.status === 0 ? (prefix.stdout ?? "").trim() : "";
  const out: string[] = [];
  const entries = r.stdout.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2);
    const file = entries[i].slice(3);
    // A rename is followed by its old name, which is not a file any more.
    if (status.includes("R") || status.includes("C")) i++;
    if (status.includes("D")) continue;
    if (under && !file.startsWith(under)) continue;
    out.push(file.slice(under.length));
  }
  return out;
}

/**
 * How to start the CLI on this platform (REQ-424). On Windows `npx` is
 * `npx.cmd`, which Node will only spawn through a shell (CVE-2024-27980);
 * the arguments are fixed words and the project goes in as the working
 * directory, so nothing from outside reaches that command line.
 */
export function specgateCommand(platform: string = process.platform): {
  command: string;
  shell: boolean;
} {
  return platform === "win32"
    ? { command: "npx.cmd", shell: true }
    : { command: "npx", shell: false };
}

type Spawn = (
  command: string,
  args: string[],
  options: { cwd: string; shell: boolean; encoding: "utf8"; timeout: number; maxBuffer: number }
) => { status: number | null; stdout: string; stderr: string; error?: Error };

/** Run `specgate <args>` in `cwd`, as installed in the project or on the PATH. */
export function runSpecgate(
  args: string[],
  cwd: string,
  opts: { platform?: string; spawn?: Spawn; timeout?: number } = {}
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const { command, shell } = specgateCommand(opts.platform);
  const spawn: Spawn = opts.spawn ?? (spawnSync as unknown as Spawn);
  return spawn(command, ["--no-install", "specgate", ...args], {
    cwd,
    shell,
    encoding: "utf8",
    timeout: opts.timeout ?? 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}
