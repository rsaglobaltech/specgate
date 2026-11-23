/**
 * Trust levels per module (ADR-0046, change trust-levels).
 *
 * `trust:` in `.specgate/gate.yaml` maps a capability — the brief's module —
 * to how far an agent may go in it (REQ-670):
 *
 *   trust: { pagos: 2, catalogo: 4 }     # or one per line
 *   trust:
 *     catalogo: 4
 *     promote_after: 10                  # the streak that makes a promotion ready
 *
 * The harness does only what a level allows (REQ-671). A level rises only
 * through an approved change (REQ-672) and drops at once with a bug (REQ-673),
 * each recorded in `.specgate/trust-ledger.jsonl`. `specgate trust` shows the
 * evidence (REQ-674). A project with no `trust:` is untouched.
 */

import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { GATE_POLICY_FILE } from "./gate-policy";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { error } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import { capabilityNames, requirementCapabilities } from "./capabilities";
import { withPrinciple, type LearnedRule } from "../../packages/core/src/domain/Lessons";
import { PRINCIPLES_FILE } from "../../packages/core/src/domain/Principles";

export const TRUST_LEDGER = ".specgate/trust-ledger.jsonl";
/** Each requirement `apply` delivered, with when: the evidence a streak counts. */
export const APPLIED_LOG = ".specgate/applied.jsonl";
export const MAX_LEVEL = 5;
/** The run's intent for trust levels, set by a parent harness run, inherited by its workers. */
export const TRUST_RUN_VAR = "SPECGATE_TRUST_RUN";
export const DEFAULT_PROMOTE_AFTER = 10;

export const LEVEL_NAMES: Record<number, string> = {
  1: "observed",
  2: "confined",
  3: "verified",
  4: "unattended",
  5: "triage",
};

export interface TrustPolicy {
  /** Each capability as written, its value unchecked. */
  readonly declared: ReadonlyMap<string, unknown>;
  readonly promoteAfter: number;
}

export type LedgerReason = "declared" | "promotion" | "leak" | "lowered";

export interface LedgerLine {
  capability: string;
  from: number | null;
  to: number;
  reason: LedgerReason;
  change: string | null;
  at: string;
}

/** `{ a: 1, b: 2 }`, the flow map YamlLite keeps as a string. */
function flowMap(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  const out: Record<string, unknown> = {};
  for (const part of t.slice(1, -1).split(",")) {
    if (!part.trim()) continue;
    const i = part.indexOf(":");
    if (i < 0) return null;
    const value = part.slice(i + 1).trim();
    out[part.slice(0, i).trim()] = /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return out;
}

/** The `trust:` block of the gate policy, or null when the project declares none. */
export function readTrust(projectDir: string): TrustPolicy | null {
  const file = path.join(projectDir, GATE_POLICY_FILE);
  if (!fs.existsSync(file)) return null;
  let doc: unknown;
  try {
    doc = parseYamlLite(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object" || !("trust" in (doc as object))) return null;
  const raw = (doc as Record<string, unknown>).trust;
  const map =
    typeof raw === "string" ? flowMap(raw) : raw && typeof raw === "object" ? raw : null;
  const declared = new Map<string, unknown>();
  let promoteAfter = DEFAULT_PROMOTE_AFTER;
  for (const [k, v] of Object.entries((map || {}) as Record<string, unknown>)) {
    if (k === "promote_after") {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0) promoteAfter = n;
    } else declared.set(k, v);
  }
  return { declared, promoteAfter };
}

const validLevel = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL ? n : null;
};

/** A capability's level: as declared, 1 when the map leaves it out or says nonsense. */
export function trustLevel(trust: TrustPolicy, capability: string): number {
  return validLevel(trust.declared.get(capability)) ?? 1;
}

export function readLedger(projectDir: string): LedgerLine[] {
  const file = path.join(projectDir, TRUST_LEDGER);
  if (!fs.existsSync(file)) return [];
  const out: LedgerLine[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a line a person broke is not evidence */
    }
  }
  return out;
}

export function appendLedger(projectDir: string, line: Omit<LedgerLine, "at">, at = new Date()) {
  const file = path.join(projectDir, TRUST_LEDGER);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ ...line, at: at.toISOString() })}\n`, "utf8");
}

function lastLine(ledger: LedgerLine[], capability: string): LedgerLine | undefined {
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    if (ledger[i].capability === capability) return ledger[i];
  }
  return undefined;
}

/**
 * The gate's findings on `trust:` (REQ-670, REQ-672). With `record`, a first
 * declaration is written to the ledger as `declared` and a level lowered by
 * hand as `lowered`: the next check keeps the record a promotion is judged by.
 */
export function trustFindings(projectDir: string, record = true): Diagnostic[] {
  const trust = readTrust(projectDir);
  if (!trust) return [];
  const out: Diagnostic[] = [];
  const known = capabilityNames(requirementCapabilities(projectDir));
  const ledger = readLedger(projectDir);
  for (const [capability, value] of trust.declared) {
    const level = validLevel(value);
    if (level === null) {
      out.push(
        error(
          "trust_invalid",
          `trust: ${capability} is ${String(value)}, and the levels are 1 to ${MAX_LEVEL}.`,
          {
            target: capability,
            file: GATE_POLICY_FILE,
            fix: `Write a level from 1 (observed) to ${MAX_LEVEL} (triage): \`${capability}: 3\`. Level 6, merging alone, comes in a later change.`,
          }
        )
      );
      continue;
    }
    if (!known.includes(capability)) {
      out.push(
        error("trust_unknown_capability", `trust: ${capability} is not a capability of this project.`, {
          target: capability,
          file: GATE_POLICY_FILE,
          fix: known.length
            ? `Use one of: ${known.join(", ")}.`
            : "This project has no capability yet: `specgate propose <change-id> --capability <name>` opens one.",
        })
      );
      continue;
    }
    const last = lastLine(ledger, capability);
    if (!last) {
      if (record)
        appendLedger(projectDir, { capability, from: null, to: level, reason: "declared", change: null });
    } else if (level > last.to) {
      out.push(
        error(
          "trust_raised_unapproved",
          `trust: ${capability} is ${level}, and no approved change raised it from ${last.to}.`,
          {
            target: capability,
            file: GATE_POLICY_FILE,
            fix: `Put it back to ${last.to}, then \`specgate trust promote ${capability}\`: a person approves the rise.`,
          }
        )
      );
    } else if (level < last.to && record) {
      appendLedger(projectDir, { capability, from: last.to, to: level, reason: "lowered", change: null });
    }
  }
  return out;
}

/** `capability: level` written into `trust:` of gate.yaml, every other byte kept. */
export function writeTrustLevel(projectDir: string, capability: string, level: number): void {
  const file = path.join(projectDir, GATE_POLICY_FILE);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const at = lines.findIndex((l) => /^trust:/.test(l));
  if (at < 0) throw new Error(`${GATE_POLICY_FILE} has no trust: block.`);
  const flow = lines[at].slice("trust:".length).trim();
  if (flow) {
    const map = flowMap(flow) || {};
    map[capability] = level;
    lines[at] = `trust: { ${Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")} }`;
  } else {
    let i = at + 1;
    let found = -1;
    for (; i < lines.length && /^\s+\S/.test(lines[i]); i += 1) {
      if (lines[i].trim().split(":")[0].trim() === capability) found = i;
    }
    const indent = (lines[at + 1] || "").match(/^\s+/)?.[0] || "  ";
    if (found >= 0) lines[found] = lines[found].replace(/:\s*\S+/, `: ${level}`);
    else lines.splice(i, 0, `${indent}${capability}: ${level}`);
  }
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}

/** What a requirement needs to be run by the harness (REQ-671). */
export interface HarnessIntent {
  /** The person named it with --req. */
  named: boolean;
  concurrency: number;
  /** It belongs to a change opened with --kind bug. */
  bug: boolean;
}

/** The level a run like this needs: 2 named and one at a time, 3 queued, 4 in parallel, 5 a bug. */
export function levelNeeded(intent: HarnessIntent): number {
  if (intent.bug) return 5;
  if (intent.concurrency > 1) return 4;
  return intent.named ? 2 : 3;
}

/** What a skipped requirement's report says. */
export function trustSkip(capability: string, level: number, needed: number): string {
  return (
    `trust_level: ${capability} is at level ${level} (${LEVEL_NAMES[level]}), and this run needs ${needed}` +
    (level === 1
      ? ". An agent works here only with a person watching."
      : `. Fix: \`specgate trust\` shows what ${capability} has earned.`)
  );
}

export function appendApplied(projectDir: string, req: string, at = new Date()): void {
  const capability = requirementCapabilities(projectDir).get(req);
  if (!capability) return;
  const file = path.join(projectDir, APPLIED_LOG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ req, capability, at: at.toISOString() })}\n`, "utf8");
}

function jsonLines(file: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(file)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      /* skip */
    }
  }
  return out;
}

export interface TrustRow {
  capability: string;
  level: number;
  name: string;
  applied: number;
  streak: number;
  leaks: number;
  ready: boolean;
  next: string | null;
}

/**
 * How much each capability has earned (REQ-674). Its streak: the requirements
 * applied, or delivered by a passed harness attempt, since its last leak and
 * its last failed attempt.
 */
export function trustReport(projectDir: string): { declared: boolean; capabilities: TrustRow[] } {
  const trust = readTrust(projectDir);
  const caps = requirementCapabilities(projectDir);
  const names = capabilityNames(caps);
  const ledger = readLedger(projectDir);
  const applied = jsonLines(path.join(projectDir, APPLIED_LOG));
  const attempts: Array<{ req: string; at: number; pass: boolean }> = [];
  const eventsDir = path.join(projectDir, ".harness", "events");
  if (fs.existsSync(eventsDir)) {
    for (const f of fs.readdirSync(eventsDir)) {
      if (!/^REQ-[\w-]+\.jsonl$/.test(f)) continue;
      for (const e of jsonLines(path.join(eventsDir, f))) {
        if (e.type === "attempt" && e.state === "end" && (e.result === "pass" || e.result === "fail"))
          attempts.push({ req: String(e.req), at: Number(e.t) * 1000, pass: e.result === "pass" });
      }
    }
  }
  const delivered = new Set(
    [...caps.keys()].filter((id) => applied.some((a) => a.req === id))
  );
  const rows = names.map((capability) => {
    const level = trust ? trustLevel(trust, capability) : 1;
    const leaks = ledger.filter((l) => l.capability === capability && l.reason === "leak");
    const reqs = new Set([...caps].filter(([, c]) => c === capability).map(([id]) => id));
    const lastLeak = leaks.length ? Date.parse(leaks[leaks.length - 1].at) : 0;
    const fails = attempts.filter((a) => reqs.has(a.req) && !a.pass).map((a) => a.at);
    const cutoff = Math.max(lastLeak, ...fails, 0);
    const since = new Set<string>();
    for (const a of applied) {
      if (a.capability === capability && Date.parse(String(a.at)) > cutoff) since.add(String(a.req));
    }
    for (const a of attempts) if (reqs.has(a.req) && a.pass && a.at > cutoff) since.add(a.req);
    const streak = since.size;
    const ready = Boolean(trust) && level < MAX_LEVEL && streak >= (trust?.promoteAfter ?? DEFAULT_PROMOTE_AFTER);
    return {
      capability,
      level,
      name: LEVEL_NAMES[level],
      applied: [...reqs].filter((id) => delivered.has(id)).length,
      streak,
      leaks: leaks.length,
      ready,
      next: ready ? `specgate trust promote ${capability}` : null,
    };
  });
  return { declared: Boolean(trust), capabilities: rows };
}

/** `trust-<capability>-<level>`: the change a promotion is carried by. */
export const promotionChangeId = (capability: string, to: number) => `trust-${capability}-${to}`;

/** The promotion a change carries, from its change.yaml `trust_promotion: <capability> <from> <to>`. */
export function promotionOf(text: string): { capability: string; from: number; to: number } | null {
  const m = text.match(/^trust_promotion:\s*(\S+)\s+(\d)\s+(\d)\s*$/m);
  return m ? { capability: m[1], from: Number(m[2]), to: Number(m[3]) } : null;
}

/**
 * A bug proposed for a capability lowers its level by one at once, never below
 * 1, with a `leak` line naming the change (REQ-673). Null when the project
 * declares no trust or the capability is not in it.
 */
export function lowerOnLeak(
  projectDir: string,
  capability: string,
  change: string
): { capability: string; from: number; to: number } | null {
  const trust = readTrust(projectDir);
  if (!trust) return null;
  const from = trustLevel(trust, capability);
  const to = Math.max(1, from - 1);
  if (!readLedger(projectDir).some((l) => l.capability === capability)) {
    appendLedger(projectDir, { capability, from: null, to: from, reason: "declared", change: null });
  }
  writeTrustLevel(projectDir, capability, to);
  appendLedger(projectDir, { capability, from, to, reason: "leak", change });
  return { capability, from, to };
}

/**
 * Once every layer of a promotion change is approved, its level is written and
 * its `promotion` line appended (REQ-672). Once only: a second approval of the
 * same change writes nothing.
 */
export function applyPromotion(
  projectDir: string,
  change: string
): { capability: string; from: number; to: number } | null {
  const config = path.join(projectDir, "docs", "specs", "changes", change, "change.yaml");
  if (!fs.existsSync(config)) return null;
  const promotion = promotionOf(fs.readFileSync(config, "utf8"));
  if (!promotion || !readTrust(projectDir)) return null;
  const ledger = readLedger(projectDir);
  if (ledger.some((l) => l.reason === "promotion" && l.change === change)) return null;
  writeTrustLevel(projectDir, promotion.capability, promotion.to);
  appendLedger(projectDir, { ...promotion, reason: "promotion", change });
  return promotion;
}

/** The evidence a promotion change's Discover carries. */
export function promotionDiscover(row: TrustRow, to: number, promoteAfter: number): string {
  return [
    `# Discover: ${promotionChangeId(row.capability, to)}`,
    "",
    "## Context",
    "",
    `${row.capability} is at trust level ${row.level} (${row.name}). Since its last leak it has delivered ${row.streak} requirement(s) with no failed harness attempt; the policy asks for ${promoteAfter}. It has had ${row.leaks} leak(s) in all, and ${row.applied} requirement(s) applied.`,
    "",
    "## Use case",
    "",
    `1. The Developer reads this evidence.`,
    `2. A person approves the three layers, and ${row.capability} goes to level ${to} (${LEVEL_NAMES[to]}).`,
    "",
    "## Acceptance criteria",
    "",
    `- AC-1: ${row.capability} is at level ${to} once this change is approved, and the trust ledger names it.`,
    "",
  ].join("\n");
}

/** What the parent harness run asks: the requirements named with --req, and its concurrency. */
export interface RunIntent {
  named: string[];
  concurrency: number;
}

export function runIntent(env: NodeJS.ProcessEnv = process.env): RunIntent {
  try {
    const r = JSON.parse(env[TRUST_RUN_VAR] || "{}");
    return { named: Array.isArray(r.named) ? r.named : [], concurrency: Number(r.concurrency) || 1 };
  } catch {
    return { named: [], concurrency: 1 };
  }
}

/** Why the module's trust level keeps this requirement from the harness, if it does (REQ-671). */
export function harnessTrustRefusal(
  projectDir: string,
  id: string,
  change: string | undefined,
  run: RunIntent
): string | null {
  const trust = readTrust(projectDir);
  if (!trust) return null;
  const capability = requirementCapabilities(projectDir).get(id);
  if (!capability) return null;
  let bug = false;
  if (change) {
    try {
      const config = fs.readFileSync(
        path.join(projectDir, "docs", "specs", "changes", change, "change.yaml"),
        "utf8"
      );
      bug = /^kind:\s*bug\s*$/m.test(config);
    } catch {
      /* no config, no kind */
    }
  }
  const level = trustLevel(trust, capability);
  const needed = levelNeeded({ named: run.named.includes(id), concurrency: run.concurrency, bug });
  return level >= needed ? null : trustSkip(capability, level, needed);
}

/** `--chain` in a project with trust levels: merging alone is level 6, not declarable yet (REQ-671). */
export function chainRefusal(projectDir: string): string | null {
  if (!readTrust(projectDir)) return null;
  // lab-fixes REQ-694: chaining onto a branch of one's own leaves the merge
  // into the main branch to a person; only that merge is level 6.
  const branch = currentBranch(projectDir);
  if (branch && !mainBranches(projectDir).includes(branch)) return null;
  return (
    "harness_trust_chain: --chain merges each green requirement alone, and this project " +
    "declares trust levels: merging alone into the main branch is level 6, which no module " +
    "can have yet. Chain on a branch of your own (`git switch -c feature/<module>`) and merge " +
    "it yourself, or run without --chain."
  );
}

function gitOut(projectDir: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
  return r.status === 0 ? String(r.stdout || "").trim() : "";
}

/** The branch checked out, or "" outside git or on a detached head. */
function currentBranch(projectDir: string): string {
  const b = gitOut(projectDir, "rev-parse", "--abbrev-ref", "HEAD");
  return b === "HEAD" ? "" : b;
}

/** `main`, `master`, and the branch `origin/HEAD` names. */
function mainBranches(projectDir: string): string[] {
  const head = gitOut(projectDir, "symbolic-ref", "--short", "refs/remotes/origin/HEAD");
  return ["main", "master", ...(head ? [head.replace(/^origin\//, "")] : [])];
}

/**
 * Once every layer of a `learn-…` change is approved, its rule is appended to
 * docs/specs/principles.md (REQ-685). Once only.
 */
export function applyLearnedRule(projectDir: string, change: string): boolean {
  const config = path.join(projectDir, "docs", "specs", "changes", change, "change.yaml");
  if (!fs.existsSync(config)) return false;
  const m = fs.readFileSync(config, "utf8").match(/^learn_principle:\s*(\{.*\})\s*$/m);
  if (!m) return false;
  let rule: LearnedRule;
  try {
    rule = JSON.parse(m[1]);
  } catch {
    return false;
  }
  const file = path.join(projectDir, PRINCIPLES_FILE);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current && new RegExp(`^#{2,4}\\s+P\\d+\\s+—\\s+${rule.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(current))
    return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, withPrinciple(current, rule), "utf8");
  return true;
}
