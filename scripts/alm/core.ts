/**
 * ALM (Jira / Azure Boards) synchronisation core — provider-agnostic.
 *
 * Enterprise requirements live in the ALM, not in markdown; without a link
 * the traceability matrix and the board drift apart (friction F7). This
 * module keeps them honest:
 *
 *   - every REQ in the traceability matrix maps to exactly one ALM issue
 *     (mapping persisted in .specops/alm-map.json, committed);
 *   - REQs without an issue get one created;
 *   - a REQ reaching Implemented/Verified/Released transitions its issue
 *     to Done;
 *   - an issue closed while its REQ is still open is reported as DRIFT.
 *
 * All network access goes through an injected `client` so the logic is
 * fully testable offline: { createIssue, getIssueStatus, closeIssue }.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { warning } from "../lib/diagnostics";
import type { Diagnostic } from "../lib/diagnostics";
import { PROVIDERS, getProvider } from "./providers";
import { CORE_CONFIG_KEYS } from "./port";
import type { AlmCapabilities, AlmClient, AlmConfig } from "./port";

export const MAP_RELPATH = path.join(".specops", "alm-map.json");
export const CONFIG_FILENAME = "alm.config.yaml";

/** Matrix statuses that mean "this requirement is delivered". */
export const DONE_STATUSES = new Set(["Implemented", "Verified", "Released"]);

/** One requirement as the sync sees it: delivered or not, nothing finer. */
export interface AlmRequirement {
  id: string;
  title: string;
  status: "done" | "open";
}

/** The ALM issue a requirement is linked to. */
export interface AlmMapEntry {
  issue: string;
  url?: string | null;
}

/** `.specops/alm-map.json`: REQ id → its issue. */
export type AlmMap = Record<string, AlmMapEntry>;

/** What the sync did, or would do, for one requirement. */
export interface SyncAction {
  req: string;
  action:
    | "would-create"
    | "created"
    | "close-unsupported"
    | "would-close"
    | "closed"
    | "drift"
    | "in-sync";
  issue: string | null;
  detail?: string;
}

/**
 * The part of an `AlmClient` the sync calls. `capabilities` is optional
 * because a client that declares none is taken to support everything.
 */
export type SyncClient = Pick<AlmClient, "createIssue" | "getIssueStatus" | "closeIssue"> & {
  capabilities?: Partial<AlmCapabilities>;
};

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Read alm.config.yaml. Tokens are NEVER stored in the file — only the
 * name of the environment variable that holds them.
 */
export function readAlmConfig(projectDir: string): AlmConfig {
  const cfgPath = path.join(projectDir, CONFIG_FILENAME);
  if (!fs.existsSync(cfgPath)) {
    // Built from the declarations rather than written out: a hand-kept example
    // teaches whichever provider it was written for. It used to show
    // `project_key`, which GitHub does not read at all — the same key its own
    // linter now warns about.
    const perProvider = PROVIDERS.map(
      (p) =>
        `  # ${p.label}\n` +
        `  provider: ${p.id}\n` +
        [...p.config.required].map((k) => `  ${k}: …`).join("\n") +
        (p.config.optional.length > 0 ? `\n  # optional: ${[...p.config.optional].join(", ")}` : "")
    ).join("\n\n");

    throw new Error(
      `${CONFIG_FILENAME} not found in ${projectDir}.\n` +
        "Fix: create it with `alm_version: 1` and one of:\n\n" +
        `${perProvider}\n\n` +
        "Credentials are never in this file: `token_env` names the environment " +
        "variable that holds the token."
    );
  }
  // The parser cannot know this document's shape; the port declares it, so the
  // cast happens once, here, at the file boundary.
  const cfg = (parseYamlLite(fs.readFileSync(cfgPath, "utf8")) || {}) as unknown as AlmConfig;
  if (!cfg.provider) throw new Error(`${CONFIG_FILENAME}: missing required key 'provider'.`);

  // Which keys are required is the provider's business, not this function's.
  // Asking every provider for the same four was how a Jira config with no
  // `user_env` passed here and failed at network time instead.
  const provider = getProvider(cfg.provider, projectDir);
  for (const key of provider.config.required) {
    if (!cfg[key]) {
      throw new Error(
        `${CONFIG_FILENAME}: missing required key '${key}' for provider '${provider.id}'.\n` +
          `Fix: add it. ${provider.label} requires: ${provider.config.required.join(", ")}.`
      );
    }
  }
  return cfg;
}

/**
 * Report the keys in a config that nothing will read.
 *
 * `harness.config.yaml` rejects an unknown key outright, on the grounds that a
 * key nobody reads is worse than a missing one because the file looks
 * configured. The same reasoning applies here, but this file predates the
 * check and rejecting outright would break a working pipeline over a stray
 * line — so it warns, and says which provider *would* have read the key. That
 * second half is the useful part: `done_state` is real, and doing nothing on
 * a Jira project is exactly the failure this reports.
 *
 * @returns {object[]} diagnostics, empty when every key is read
 */
export function lintAlmConfig(cfg: AlmConfig, projectDir?: string): Diagnostic[] {
  const provider = getProvider(cfg.provider, projectDir);
  const read = new Set([
    ...CORE_CONFIG_KEYS,
    ...provider.config.required,
    ...provider.config.optional,
  ]);

  const diagnostics: Diagnostic[] = [];
  for (const key of Object.keys(cfg)) {
    if (read.has(key)) continue;
    const alsoIn = PROVIDERS.filter(
      (p) => p.id !== provider.id && [...p.config.required, ...p.config.optional].includes(key)
    ).map((p) => p.id);

    diagnostics.push(
      warning(
        "alm_config_unread_key",
        alsoIn.length > 0
          ? `'${key}' is read by ${alsoIn.join(", ")}, not by ${provider.id} — it does nothing here.`
          : `'${key}' is read by no ALM provider.`,
        {
          target: key,
          file: CONFIG_FILENAME,
          fix:
            alsoIn.length > 0
              ? `Remove '${key}', or switch provider to ${alsoIn[0]} if that is what you meant.`
              : `Remove '${key}'. ${provider.label} reads: ${[...read].sort().join(", ")}.`,
        }
      )
    );
  }
  return diagnostics;
}

// ── Mapping file ──────────────────────────────────────────────────────────────

export function readAlmMap(projectDir: string): AlmMap {
  const mapPath = path.join(projectDir, MAP_RELPATH);
  if (!fs.existsSync(mapPath)) return {};
  // The file is ours, written by `writeAlmMap`; its shape is trusted here.
  return JSON.parse(fs.readFileSync(mapPath, "utf8")) as AlmMap;
}

export function writeAlmMap(projectDir: string, map: AlmMap, dryRun: boolean): string {
  const mapPath = path.join(projectDir, MAP_RELPATH);
  if (dryRun) return mapPath;
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return mapPath;
}

// ── Requirement extraction ────────────────────────────────────────────────────

/**
 * Read REQ ids + aggregated status from the traceability matrix, and their
 * titles from spec.md. A REQ is "done" when every one of its rows carries a
 * done status.
 * @returns Array<{ id, title, status: "done"|"open" }>
 */
export function extractRequirements(projectDir: string): AlmRequirement[] {
  const tracePath = path.join(projectDir, "docs", "specs", "traceability.md");
  if (!fs.existsSync(tracePath)) {
    throw new Error(`No traceability matrix at ${tracePath} — run adopt/init first.`);
  }
  const spec = fs.existsSync(path.join(projectDir, "spec.md"))
    ? fs.readFileSync(path.join(projectDir, "spec.md"), "utf8")
    : "";
  const titles: Record<string, string> = {};
  for (const m of spec.matchAll(/^##\s+(REQ-\d+)\s*[—-]\s*(.+)$/gm)) {
    titles[m[1]] = m[2].trim();
  }

  const rowsByReq = new Map<string, string[]>();
  for (const line of fs.readFileSync(tracePath, "utf8").split("\n")) {
    if (!line.trim().startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const req = cells.find((c) => /^REQ-\d+$/.test(c));
    if (!req) continue;
    const status = cells[cells.length - 2] || "";
    if (!rowsByReq.has(req)) rowsByReq.set(req, []);
    rowsByReq.get(req)!.push(status);
  }

  return [...rowsByReq.entries()].map(([id, statuses]) => ({
    id,
    title: titles[id] || id,
    status: statuses.length > 0 && statuses.every((s) => DONE_STATUSES.has(s)) ? "done" : "open",
  }));
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Reconcile requirements with the ALM through the injected client.
 * @param {Array<{id,title,status}>} requirements
 * @param {Record<string,{issue:string}>} map REQ → issue mapping (mutated)
 * @param {{createIssue,getIssueStatus,closeIssue}} client
 * @param {{ dryRun?: boolean }} opts
 * @returns {Promise<Array<{req,action,issue,detail?}>>} actions taken/planned
 */
export async function syncRequirements(
  requirements: readonly AlmRequirement[],
  map: AlmMap,
  client: SyncClient,
  opts?: { dryRun?: boolean }
): Promise<SyncAction[]> {
  const dryRun = !!(opts && opts.dryRun);
  const actions: SyncAction[] = [];

  for (const req of requirements) {
    const linked = map[req.id];

    if (!linked) {
      if (dryRun) {
        actions.push({ req: req.id, action: "would-create", issue: null });
        continue;
      }
      const issue = await client.createIssue(req.id, req.title);
      map[req.id] = { issue: issue.key, url: issue.url || null };
      actions.push({ req: req.id, action: "created", issue: issue.key });
      continue;
    }

    const issueStatus = await client.getIssueStatus(linked.issue); // "open" | "done"
    if (req.status === "done" && issueStatus !== "done") {
      // A provider that cannot close says so up front, and the run reports it
      // per requirement rather than throwing halfway through the queue.
      if (client.capabilities && client.capabilities.close === false) {
        actions.push({
          req: req.id,
          action: "close-unsupported",
          issue: linked.issue,
          detail: `${req.id} is done, but this provider cannot close ${linked.issue} — close it by hand.`,
        });
        continue;
      }
      if (!dryRun) await client.closeIssue(linked.issue);
      actions.push({
        req: req.id,
        action: dryRun ? "would-close" : "closed",
        issue: linked.issue,
      });
    } else if (req.status !== "done" && issueStatus === "done") {
      actions.push({
        req: req.id,
        action: "drift",
        issue: linked.issue,
        detail: `${linked.issue} is done in the ALM but ${req.id} is not Implemented in traceability.md`,
      });
    } else {
      actions.push({ req: req.id, action: "in-sync", issue: linked.issue });
    }
  }

  return actions;
}
