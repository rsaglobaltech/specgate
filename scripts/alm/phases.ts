/**
 * The board follows the change (REQ-305, REQ-307).
 *
 * A change's phase is read from the repository, never from the board: open
 * and not yet built, one of its requirements being built, or archived. The
 * board is told; it is never asked what the change is (ADR-0021). What the
 * sync has told the board is kept in `.specops/alm-phases.json`, beside the
 * REQ ↔ issue mapping, so a move already made is not made again and a
 * sub-issue is never created twice.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import type { AlmClient, AlmConfig, Phase } from "./port";

export const PHASES_RELPATH = path.join(".specops", "alm-phases.json");
const CHANGES = path.join("docs", "specs", "changes");

/** What the sync has told the board about one change. */
export interface PhaseRecord {
  ticket: string;
  phase?: Phase;
  state?: string;
  /** Repository → its sub-issue (REQ-307). */
  children?: Record<string, string>;
  /** Comment ids already brought back as notes (REQ-306). */
  comments?: string[];
  /** The description as last pulled, to tell a change (REQ-306). */
  description?: string;
}

/** `.specops/alm-phases.json`: change id → what the board was told. */
export type PhaseMap = Record<string, PhaseRecord>;

/** A change as the board sees it. */
export interface BoardChange {
  readonly id: string;
  readonly dir: string;
  readonly archived: boolean;
  readonly ticket: string | null;
  readonly repositories: readonly string[];
  readonly requirements: readonly string[];
  readonly phase: Phase;
}

export interface PhaseAction {
  change: string;
  action: "would-move" | "moved" | "in-sync" | "phase-unsupported";
  issue: string;
  phase: Phase;
  state?: string;
  detail?: string;
}

export interface SubIssueAction {
  change: string;
  action: "would-create" | "created" | "sub-issues-unsupported" | "no-ticket";
  repo?: string;
  issue?: string;
  detail?: string;
}

// ── The map ───────────────────────────────────────────────────────────────────

export function readPhaseMap(projectDir: string): PhaseMap {
  const mapPath = path.join(projectDir, PHASES_RELPATH);
  if (!fs.existsSync(mapPath)) return {};
  return JSON.parse(fs.readFileSync(mapPath, "utf8")) as PhaseMap;
}

export function writePhaseMap(projectDir: string, map: PhaseMap, dryRun: boolean): string {
  const mapPath = path.join(projectDir, PHASES_RELPATH);
  if (dryRun) return mapPath;
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return mapPath;
}

// ── Changes and their phase ───────────────────────────────────────────────────

/** The ticket a change carries: `ticket:`, or the issue `alm pull` opened it from. */
export function changeTicket(yaml: Record<string, unknown>): string | null {
  const ticket = typeof yaml.ticket === "string" ? yaml.ticket.trim() : "";
  if (ticket) return ticket;
  const origin = typeof yaml.origin === "string" ? /^alm:(\S+)$/.exec(yaml.origin.trim()) : null;
  return origin ? origin[1] : null;
}

function readYaml(file: string): Record<string, unknown> {
  if (!fs.existsSync(file)) return {};
  return (parseYamlLite(fs.readFileSync(file, "utf8")) || {}) as Record<string, unknown>;
}

function deltaRequirements(changeDir: string): string[] {
  const found = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "spec.md") {
        for (const m of fs
          .readFileSync(full, "utf8")
          .matchAll(/^###\s+Requirement:\s+(REQ-\d+)/gm)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(path.join(changeDir, "specs"));
  return [...found];
}

/** The local `harness/REQ-NNN` branches: a requirement the harness has started. */
function harnessBranches(projectDir: string): Set<string> {
  const r = spawnSync("git", ["branch", "--list", "harness/REQ-*", "--format=%(refname:short)"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (r.status !== 0) return new Set();
  return new Set(
    r.stdout
      .split("\n")
      .map((l) => l.trim().replace(/^harness\//, ""))
      .filter(Boolean)
  );
}

/** Requirements the matrix says are delivered. */
function implementedRequirements(projectDir: string): Set<string> {
  const file = path.join(projectDir, "docs", "specs", "traceability.md");
  const done = new Set<string>();
  if (!fs.existsSync(file)) return done;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    const req = cells.find((c) => /^REQ-\d+$/.test(c));
    if (req && /^(Implemented|Verified|Released)$/.test(cells[cells.length - 2] || "")) {
      done.add(req);
    }
  }
  return done;
}

/**
 * Every change, open or archived, with its phase. An archived change keeps its
 * id after the date prefix the archive gives it (`2026-10-29-alerts`).
 */
export function boardChanges(projectDir: string): BoardChange[] {
  const root = path.join(projectDir, CHANGES);
  if (!fs.existsSync(root)) return [];
  const branches = harnessBranches(projectDir);
  const implemented = implementedRequirements(projectDir);
  const out: BoardChange[] = [];

  const add = (dir: string, id: string, archived: boolean) => {
    const yaml = readYaml(path.join(dir, "change.yaml"));
    const requirements = deltaRequirements(dir);
    const building = requirements.some((r) => branches.has(r) || implemented.has(r));
    const repositories = Array.isArray(yaml.repositories)
      ? (yaml.repositories as unknown[]).map(String).filter(Boolean)
      : [];
    out.push({
      id,
      dir,
      archived,
      ticket: changeTicket(yaml),
      repositories,
      requirements,
      phase: archived ? "archived" : building ? "building" : "proposed",
    });
  };

  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    if (e.name === "archive") {
      const archive = path.join(root, "archive");
      for (const a of fs.readdirSync(archive, { withFileTypes: true })) {
        if (!a.isDirectory()) continue;
        add(path.join(archive, a.name), a.name.replace(/^\d{4}-\d{2}-\d{2}-/, ""), true);
      }
      continue;
    }
    add(path.join(root, e.name), e.name, false);
  }
  return out;
}

// ── Moving the board ──────────────────────────────────────────────────────────

/** The state `phases:` names for a phase, or undefined for the provider's default. */
export function namedState(cfg: AlmConfig, phase: Phase): string | undefined {
  const phases = cfg.phases;
  if (!phases || typeof phases !== "object") return undefined;
  const value = (phases as Record<string, unknown>)[phase];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Move one change's ticket to its phase, unless the board was already told. */
export async function movePhase(
  change: BoardChange & { ticket: string },
  map: PhaseMap,
  client: AlmClient,
  cfg: AlmConfig,
  opts: { dryRun?: boolean; phase?: Phase; force?: boolean } = {}
): Promise<PhaseAction> {
  const phase = opts.phase ?? change.phase;
  const record = (map[change.id] ??= { ticket: change.ticket });
  record.ticket = change.ticket;
  const named = namedState(cfg, phase);

  if (!opts.force && record.phase === phase) {
    return {
      change: change.id,
      action: "in-sync",
      issue: change.ticket,
      phase,
      state: record.state,
    };
  }
  if (!client.capabilities.phase || typeof client.setPhase !== "function") {
    return {
      change: change.id,
      action: "phase-unsupported",
      issue: change.ticket,
      phase,
      detail: `${change.ticket} should be ${phase}, but provider '${cfg.provider}' cannot move an issue — move it by hand.`,
    };
  }
  if (opts.dryRun) {
    return {
      change: change.id,
      action: "would-move",
      issue: change.ticket,
      phase,
      state: named ?? `the ${phase} state`,
    };
  }
  const state = await client.setPhase(change.ticket, phase, named);
  record.phase = phase;
  record.state = state;
  return { change: change.id, action: "moved", issue: change.ticket, phase, state };
}

/** REQ-305: every change with a ticket, moved to its phase. */
export async function syncPhases(
  changes: readonly BoardChange[],
  map: PhaseMap,
  client: AlmClient,
  cfg: AlmConfig,
  opts: { dryRun?: boolean } = {}
): Promise<PhaseAction[]> {
  const actions: PhaseAction[] = [];
  for (const change of changes) {
    if (!change.ticket) continue;
    actions.push(await movePhase({ ...change, ticket: change.ticket }, map, client, cfg, opts));
  }
  return actions;
}

/** REQ-307: one sub-issue per repository a change names, created once. */
export async function syncSubIssues(
  changes: readonly BoardChange[],
  map: PhaseMap,
  client: AlmClient,
  opts: { dryRun?: boolean } = {}
): Promise<SubIssueAction[]> {
  const actions: SubIssueAction[] = [];
  for (const change of changes) {
    if (change.archived || change.repositories.length === 0) continue;
    if (!change.ticket) {
      actions.push({
        change: change.id,
        action: "no-ticket",
        detail: `${change.id} names repositories but no ticket to hang their sub-issues on — add ticket: <KEY> to its change.yaml.`,
      });
      continue;
    }
    const record = (map[change.id] ??= { ticket: change.ticket });
    const children = (record.children ??= {});
    for (const repo of change.repositories) {
      if (children[repo]) continue;
      if (!client.capabilities.subIssues || typeof client.createSubIssue !== "function") {
        actions.push({
          change: change.id,
          action: "sub-issues-unsupported",
          repo,
          detail: `${change.ticket} needs a sub-issue for ${repo}, but this provider cannot create one — create it by hand.`,
        });
        continue;
      }
      if (opts.dryRun) {
        actions.push({ change: change.id, action: "would-create", repo });
        continue;
      }
      const created = await client.createSubIssue(
        change.ticket,
        `${change.ticket} — ${repo}: ${change.id}`
      );
      children[repo] = created.key;
      actions.push({ change: change.id, action: "created", repo, issue: created.key });
    }
  }
  return actions;
}
