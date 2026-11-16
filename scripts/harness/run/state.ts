/**
 * `harness run`: the state one run keeps in this process. One instance each —
 * every module reads and changes it through these functions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { streamEvent, streamFdOf } from "../../lib/harness-stream";
import { scrubText, RequirementResult } from "./shared";

/**
 * REQ-317: the role packages each requirement's prompts carried in this run,
 * recorded on its result — the report counts them across runs.
 */
const packagesUsed = new Map<string, Set<string>>();

/** The role packages `requirement`'s prompts carried so far in this run. */
export function packagesUsedBy(requirement: string): Set<string> | undefined {
  return packagesUsed.get(requirement);
}

/** Adds `ids` to the role packages `requirement`'s prompts carried. */
export function notePackagesUsed(requirement: string, ids: string[]): void {
  const seen = packagesUsed.get(requirement) || new Set<string>();
  for (const id of ids) seen.add(id);
  packagesUsed.set(requirement, seen);
}

/** REQ-585: what this process's agents reported spending in this run, in USD. */
let runSpentUsd = 0;

export function runSpentUsdSoFar(): number {
  return runSpentUsd;
}

export function addRunSpentUsd(usd: number): void {
  runSpentUsd += usd;
}

/**
 * REQ-417: set once an attempt in this run wrote files. The agent can write,
 * so an empty attempt after that is a lapse, not a missing permission
 * (truck-flote, MS8-3: REQ-002 and REQ-003 passed, REQ-004 wrote nothing).
 */
let agentWroteThisRun = false;

/** For tests run in one process. */
export function resetAgentWrote(wrote = false): void {
  agentWroteThisRun = wrote;
}

export function agentWroteInThisRun(): boolean {
  return agentWroteThisRun;
}

export function markAgentWrote(): void {
  agentWroteThisRun = true;
}

/** Where a run's record lands. Local to the machine — see `writeRunRecord`. */
export const RUNS_DIR = path.join(".harness", "runs");

/** One run, as it will be read back by `specgate harness report`. */
export interface RunRecord {
  schemaVersion: number;
  startedAt: string;
  finishedAt: string;
  baseRef: string;
  concurrency: number;
  maxAttempts: number;
  /** Whether the run had a budget ceiling (C1). A short run reads differently. */
  bounded?: boolean;
  results: unknown[];
  /** When the record was last written, while the run goes (REQ-269). */
  updatedAt?: string;
  /** The requirement the run is on, while it goes. */
  running?: { requirement: string; startedAt: string; attemptLog: unknown[] };
}

/**
 * The run's record, written as it goes (REQ-269).
 *
 * It used to be written once, at the end, so a run stopped by hand — the
 * 27 minutes truck-flote spent on semgrep hanging (S52) — left no trace, and
 * `harness report` priced the requirement without them. Now it is written when
 * each requirement starts and each attempt ends; a killed run leaves a record
 * whose `running` says where it stopped.
 */
let ledger: { projectDir: string; record: RunRecord } | null = null;

/** The run's record while it goes, or null outside a run. */
export function currentLedger(): { projectDir: string; record: RunRecord } | null {
  return ledger;
}

export function setLedger(next: { projectDir: string; record: RunRecord } | null): void {
  ledger = next;
}

export function ledgerWrite(): void {
  if (!ledger) return;
  ledger.record.updatedAt = new Date().toISOString();
  writeRunRecord(ledger.projectDir, ledger.record);
}

export function ledgerAttempts(attemptLog: unknown[]): void {
  if (!ledger || !ledger.record.running) return;
  ledger.record.running.attemptLog = [...attemptLog];
  ledgerWrite();
}

/**
 * Write what a run did, so the next question about it has an answer.
 *
 * The harness printed a report and forgot it. That is fine for one run and
 * useless for the question that decides whether agent roles are worth paying
 * for (E2-01): **what does a delivered requirement cost, and how often does the
 * first attempt work?** Neither is answerable from memory, and both are
 * answerable from a directory of these.
 *
 * The agent command is deliberately *not* recorded: it is a shell command a
 * user composed, and it is exactly the kind of string that ends up carrying an
 * API key.
 *
 * The directory ignores itself. Two reasons, and the first is not optional:
 * the harness refuses to start on a dirty tree, so a ledger git could see
 * would mean the first run makes the second one refuse — H2 of the closure
 * plan, where the harness blocked itself by writing into the project. The
 * second is that a file rewritten by every run is a merge conflict waiting to
 * happen; these numbers are local measurements, not shared history.
 *
 * Best-effort — a run that produced branches must not fail over bookkeeping.
 */

export function writeRunRecord(projectDir: string, record: RunRecord): string | null {
  try {
    const dir = path.join(projectDir, RUNS_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(dir, ".gitignore");
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "*\n", "utf8");
    const file = path.join(dir, `${record.startedAt.replace(/[:.]/g, "-")}.json`);
    // REQ-579: written whole or not at all — a crash mid-write leaves the last good record.
    const tmp = `${file}.${process.pid}.tmp`;
    // REQ-582: every string of it scrubbed of secrets.
    const clean = JSON.stringify(
      record,
      (_key, value) => (typeof value === "string" ? scrubText(value) : value),
      2
    );
    fs.writeFileSync(tmp, `${clean}\n`, "utf8");
    fs.renameSync(tmp, file);
    return file;
  } catch {
    return null;
  }
}

/** What each requirement's last `result` event said, to send a changed one again. */
const streamedResults = new Map<string, string>();

/** A requirement's result on the stream (REQ-496); again only when it changed. */
export function streamResult(result: RequirementResult): void {
  if (streamFdOf() === null) return;
  const said = JSON.stringify(result);
  if (streamedResults.get(result.requirement) === said) return;
  streamedResults.set(result.requirement, said);
  streamEvent({ type: "result", result }, result.requirement);
}
