/**
 * `.harness/sandboxes.json` (sandbox-swarm REQ-698…REQ-701): each sandbox the
 * harness made — its change and module, the folder it sees, the rules it
 * added and the hosts its kit brought — so archive and `harness sandboxes`
 * can find and remove every one of them.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sandboxNameOf, type SandboxConfig } from "../../packages/core/src/domain/Sandbox";
import {
  sbxAllow,
  sbxCreate,
  sbxExec,
  sbxKitHosts,
  sbxList,
  sbxRemove,
  sbxRemoveRule,
} from "./sbx";

export interface SandboxRecord {
  name: string;
  change: string;
  module: string;
  kit: string;
  /** The folder the sandbox sees: the module's worktrees and prompts. */
  workspace: string;
  created: string;
  /** The hosts the harness opened, and the ids of their rules. */
  rules: Array<{ host: string; id: string | null }>;
  /** The hosts the kit allows on its own. */
  kitHosts: string[];
}

const FILE = path.join(".harness", "sandboxes.json");
/** In a sandbox's folder: its name. */
export const SANDBOX_MARK = ".specgate-sandbox";

/** The sandbox whose folder holds `dir`: its name and folder, or null. */
export function sandboxAround(dir: string): { name: string; workspace: string } | null {
  let at = path.resolve(dir);
  for (;;) {
    try {
      const name = fs.readFileSync(path.join(at, SANDBOX_MARK), "utf8").trim();
      if (name) return { name, workspace: at };
    } catch {
      /* not here */
    }
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

export function readSandboxes(projectDir: string): SandboxRecord[] {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(projectDir, FILE), "utf8"));
    return Array.isArray(doc) ? (doc as SandboxRecord[]) : [];
  } catch {
    return [];
  }
}

function writeSandboxes(projectDir: string, records: SandboxRecord[]): void {
  const file = path.join(projectDir, FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Written whole and renamed: workers of one run may record at once.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

function upsert(projectDir: string, record: SandboxRecord): void {
  const rest = readSandboxes(projectDir).filter((r) => r.name !== record.name);
  writeSandboxes(projectDir, [...rest, record]);
}

/** The record whose workspace holds `dir`, if any. */
export function sandboxFor(projectDir: string, dir: string): SandboxRecord | null {
  const at = path.resolve(dir);
  return (
    readSandboxes(projectDir).find(
      (r) => at === r.workspace || at.startsWith(r.workspace + path.sep)
    ) || null
  );
}

/** The line a run prints when it starts a sandbox (REQ-699). */
export function reachLine(r: SandboxRecord): string {
  const yours = r.rules.length;
  const kit = r.kitHosts.length;
  const n = yours + kit;
  return `${r.name} may reach ${n} host${n === 1 ? "" : "s"}: ${yours} yours, ${kit} from the kit ${r.kit}`;
}

/**
 * The module's sandbox, made the first time (REQ-698): created on its own
 * folder, its hosts opened (REQ-699), `setup` run once, and recorded.
 */
export function ensureSandbox(
  projectDir: string,
  config: SandboxConfig,
  change: string,
  module: string,
  say: (line: string) => void = () => {}
): SandboxRecord {
  const name = sandboxNameOf(change, module);
  const known = readSandboxes(projectDir).find((r) => r.name === name);
  const alive = sbxList();
  if (known && (alive === null || alive.includes(name))) return known;

  const workspace = path.join(fs.realpathSync(os.tmpdir()), `specgate-sbx-${name}`);
  fs.mkdirSync(workspace, { recursive: true });
  // How an agent line finds its sandbox from a worktree inside (REQ-698).
  fs.writeFileSync(path.join(workspace, SANDBOX_MARK), `${name}\n`);
  const kit = String(config.kit || "shell");
  sbxCreate(name, kit, workspace);
  const rules = (config.allow || []).map((host) => ({ host, id: sbxAllow(name, host) }));
  const record: SandboxRecord = {
    name,
    change,
    module,
    kit,
    workspace,
    created: new Date().toISOString(),
    rules,
    kitHosts: sbxKitHosts(name),
  };
  upsert(projectDir, record);
  say(reachLine(record));
  if (config.setup) {
    const r = sbxExec(name, workspace, config.setup);
    if (!r.ok) {
      throw new Error(
        `The sandbox setup failed in ${name}: \`${config.setup}\` exited ${r.status}. ${(r.err || r.out).trim().split("\n").slice(-3).join(" ")}`
      );
    }
  }
  return record;
}

/** Removes one recorded sandbox: its rules, the sandbox, its folder, its record. */
export function removeSandbox(projectDir: string, record: SandboxRecord): void {
  for (const rule of record.rules) if (rule.id) sbxRemoveRule(record.name, rule.id);
  sbxRemove(record.name);
  fs.rmSync(record.workspace, { recursive: true, force: true });
  writeSandboxes(
    projectDir,
    readSandboxes(projectDir).filter((r) => r.name !== record.name)
  );
}

/** REQ-700: every sandbox of a change, removed; the names removed. */
export function removeChangeSandboxes(projectDir: string, change: string): string[] {
  const mine = readSandboxes(projectDir).filter((r) => r.change === change);
  for (const r of mine) removeSandbox(projectDir, r);
  return mine.map((r) => r.name);
}
