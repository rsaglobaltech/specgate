#!/usr/bin/env node

/**
 * The `Stop` hook: the spec gate, inside the agent's loop.
 *
 * `specgate validate --strict-tdd` has always run in CI — that is, *after* the
 * agent finished and left. This runs it when the agent is about to stop, while
 * it still has the context to fix what it broke, and refuses the stop while the
 * gate is red. It is the difference between a gate that reviews an agent's work
 * and one the agent cannot walk past.
 *
 * **The loop hazard is the whole design problem.** A `Stop` hook that blocks
 * whenever the gate fails can trap a session forever: the agent tries, fails,
 * is blocked, tries again. So this blocks **at most once per user prompt**,
 * keyed on the `prompt_id` the hook receives. The second time the same prompt
 * comes back it reports the findings and lets the session end, because at that
 * point the agent has already been told and a human needs to see the answer.
 *
 * Contract (verified against the hooks reference):
 *   - stdin: JSON with `cwd`, `prompt_id`, `hook_event_name`
 *   - exit 2: blocks the stop, and stderr is what Claude is told
 *   - exit 0: allows it
 * Anything unexpected exits 0. A hook that breaks a session because the CLI
 * was missing would be worse than no hook at all.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

/** What the hook is handed on stdin. Only the fields this hook reads. */
export interface StopHookInput {
  cwd?: string;
  prompt_id?: string;
  hook_event_name?: string;
}

export interface GateDiagnostic {
  code?: string;
  message?: string;
  fix?: string;
}

/** What the gate decided, before it is turned into an exit code. */
export interface GateDecision {
  block: boolean;
  message: string;
}

const MARKER_DIR = path.join(os.tmpdir(), "csda-gate-hook");

/**
 * Has this prompt already been blocked once?
 *
 * The marker is per prompt and lives in the temp directory: it must not touch
 * the project, because the harness refuses to start on a dirty tree and this
 * hook has no business dirtying anyone's repository.
 */
export function alreadyBlocked(promptId: string): boolean {
  if (!promptId) return false;
  const marker = path.join(MARKER_DIR, `${promptId.replace(/[^\w-]/g, "")}.blocked`);
  if (fs.existsSync(marker)) return true;
  try {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.writeFileSync(marker, "", "utf8");
  } catch {
    // If the marker cannot be written, err towards not blocking: a session that
    // cannot be ended is a worse failure than a gate finding that goes unsaid.
    return true;
  }
  return false;
}

/** Turn the validator's diagnostics into something an agent can act on. */
export function renderFindings(diagnostics: GateDiagnostic[]): string {
  const lines = ["The spec gate is failing, so this work is not finished:", ""];
  for (const d of diagnostics.slice(0, 10)) {
    lines.push(`  • [${d.code ?? "error"}] ${d.message ?? ""}`);
    if (d.fix) lines.push(`    fix: ${d.fix}`);
  }
  if (diagnostics.length > 10) lines.push(`  … and ${diagnostics.length - 10} more.`);
  lines.push("", "Run `specgate validate . --strict` to see all of it.");
  return lines.join("\n");
}

/**
 * Run the gate and decide.
 *
 * @param runValidate injected so the decision is testable without a CLI
 */
export function decide(
  input: StopHookInput,
  runValidate: (cwd: string) => { ok: boolean; diagnostics: GateDiagnostic[] },
  blockedAlready: (promptId: string) => boolean
): GateDecision {
  const cwd = input.cwd ?? process.cwd();

  let gate;
  try {
    gate = runValidate(cwd);
  } catch {
    // Not a spec-driven project, or no CLI on PATH. Say nothing.
    return { block: false, message: "" };
  }
  if (gate.ok) return { block: false, message: "" };

  const findings = renderFindings(gate.diagnostics);
  if (blockedAlready(input.prompt_id ?? "")) {
    // Told once already. Let the human see the answer rather than looping.
    return { block: false, message: findings };
  }
  return { block: true, message: findings };
}

function runValidate(cwd: string): { ok: boolean; diagnostics: GateDiagnostic[] } {
  if (!fs.existsSync(path.join(cwd, "spec.md"))) throw new Error("not a spec-driven project");

  // The agent's tests are new evidence for a generated matrix: regenerate it
  // first, or the hook would block the session over a stale cache instead of
  // judging the work. A no-op on a hand-kept matrix.
  spawnSync("npx", ["--no-install", "specgate", "matrix", "--project-dir", cwd], {
    encoding: "utf8",
    timeout: 60_000,
  });
  const r = spawnSync("npx", ["--no-install", "specgate", "validate", cwd, "--strict", "--json"], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error || typeof r.status !== "number") throw new Error("could not run specgate");

  let parsed: { status?: GateDiagnostic[] };
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    throw new Error("specgate validate did not emit one JSON document");
  }
  const diagnostics = (parsed.status ?? []).filter(
    (d) => (d as { severity?: string }).severity === "error"
  );
  return { ok: r.status === 0, diagnostics };
}

export function main(raw: string): number {
  let input: StopHookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    return 0;
  }

  const decision = decide(input, runValidate, alreadyBlocked);
  if (decision.message) process.stderr.write(`${decision.message}\n`);
  return decision.block ? 2 : 0;
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    raw += c;
  });
  process.stdin.on("end", () => process.exit(main(raw)));
}
