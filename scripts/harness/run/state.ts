/**
 * `harness run`: what one run keeps in this process while it goes — what its
 * agents spent, whether one has written, the role packages its prompts
 * carried, its record, and what it has already put on the stream.
 *
 * One `RunState` per run, made when the run starts and carried on its
 * context. Nothing here is module-level: two runs in one process, or a test
 * beside another, do not share it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { streamEvent, streamFdOf } from "../../lib/harness-stream";
import { scrubText, RequirementResult } from "./shared";

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

/** One run, in this process. */
export class RunState {
  /**
   * REQ-317: the role packages each requirement's prompts carried in this run,
   * recorded on its result — the report counts them across runs.
   */
  private readonly packages = new Map<string, Set<string>>();
  /** REQ-585: what this process's agents reported spending in this run, in USD. */
  private spentUsd = 0;
  /**
   * REQ-417: set once an attempt in this run wrote files. The agent can write,
   * so an empty attempt after that is a lapse, not a missing permission
   * (truck-flote, MS8-3: REQ-002 and REQ-003 passed, REQ-004 wrote nothing).
   */
  private wrote = false;
  /**
   * The run's record, written as it goes (REQ-269).
   *
   * It used to be written once, at the end, so a run stopped by hand — the
   * 27 minutes truck-flote spent on semgrep hanging (S52) — left no trace, and
   * `harness report` priced the requirement without them. Now it is written when
   * each requirement starts and each attempt ends; a killed run leaves a record
   * whose `running` says where it stopped.
   */
  private ledger: { projectDir: string; record: RunRecord } | null = null;
  /** What each requirement's last `result` event said, to send a changed one again. */
  private readonly streamed = new Map<string, string>();

  /** The role packages `requirement`'s prompts carried so far in this run. */
  packagesUsedBy(requirement: string): Set<string> | undefined {
    return this.packages.get(requirement);
  }

  /** Adds `ids` to the role packages `requirement`'s prompts carried. */
  notePackagesUsed(requirement: string, ids: string[]): void {
    const seen = this.packages.get(requirement) || new Set<string>();
    for (const id of ids) seen.add(id);
    this.packages.set(requirement, seen);
  }

  spentUsdSoFar(): number {
    return this.spentUsd;
  }

  addSpentUsd(usd: number): void {
    this.spentUsd += usd;
  }

  agentWrote(): boolean {
    return this.wrote;
  }

  markAgentWrote(): void {
    this.wrote = true;
  }

  /** The run's record while it goes, or null outside a run. */
  currentLedger(): { projectDir: string; record: RunRecord } | null {
    return this.ledger;
  }

  setLedger(next: { projectDir: string; record: RunRecord } | null): void {
    this.ledger = next;
  }

  ledgerWrite(): void {
    if (!this.ledger) return;
    this.ledger.record.updatedAt = new Date().toISOString();
    writeRunRecord(this.ledger.projectDir, this.ledger.record);
  }

  ledgerAttempts(attemptLog: unknown[]): void {
    if (!this.ledger || !this.ledger.record.running) return;
    this.ledger.record.running.attemptLog = [...attemptLog];
    this.ledgerWrite();
  }

  /** A requirement's result on the stream (REQ-496); again only when it changed. */
  streamResult(result: RequirementResult): void {
    if (streamFdOf() === null) return;
    const said = JSON.stringify(result);
    if (this.streamed.get(result.requirement) === said) return;
    this.streamed.set(result.requirement, said);
    streamEvent({ type: "result", result }, result.requirement);
  }
}

/**
 * The state of the run `ctx` belongs to. A context built by hand — a test, a
 * caller of `runLevels` — gets one the first time it is asked for.
 */
export function runStateOf(ctx: { run?: RunState }): RunState {
  if (!ctx.run) ctx.run = new RunState();
  return ctx.run;
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
