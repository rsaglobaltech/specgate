import { bddCommandFor } from "../../../lib/bdd";
import {
  readHarnessConfig,
  writeHarnessCommand,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ui from "../../../lib/ui";
import { writeGate } from "../config/CiInitCommand";
import { GATE_POLICY_FILE, gatePolicyTemplate } from "../../../lib/gate-policy";

function logInfo(msg: string) {
  process.stdout.write(ui.logLine(msg));
}

/**
 * The spec gate, installed with the project (REQ-455): the full gate of
 * `specgate ci init`, version pinned, for the provider the folder shows —
 * GitHub when it shows none. `--no-ci` leaves it out. True when it wrote the file.
 */
export function installGate(
  projectDir: string,
  opts: { dryRun: boolean; noCi?: boolean }
): boolean {
  installPolicy(projectDir, opts);
  if (opts.noCi) {
    logInfo("🚦 No CI file (--no-ci) — add the gate later with `specgate ci init`");
    return false;
  }
  if (opts.dryRun) {
    // What the write would do, so the dry run lists only what is written (REQ-489).
    const would = writeGate(projectDir, { dryRun: true });
    logInfo(
      would.written
        ? `[dry-run] write ${would.dest} (the spec gate; --no-ci leaves it out)`
        : `🚦 CI: ${would.dest} kept as it is`
    );
    return false;
  }
  const gate = writeGate(projectDir);
  logInfo(
    gate.written
      ? `🚦 CI: ${gate.dest} — the spec gate; \`specgate ci status\` says what it checks`
      : `🚦 CI: ${gate.dest} kept as it is`
  );
  return gate.written;
}

/**
 * The gate written a moment ago, written again now that the test command is
 * saved: the job then runs `check .`, which reads `test_cmd`, so CI runs what
 * `specgate check` runs here and follows a later `config set test_cmd`. Written
 * before the command was saved, it carried its own copy of it.
 */
export function refreshGate(projectDir: string): void {
  writeGate(projectDir, { force: true });
  setUpBdd(projectDir);
}

/**
 * The command that runs the feature files, by the stack, when the harness has
 * none yet (bdd-gate REQ-663); the gate says to set it when the stack does not.
 */
export function setUpBdd(projectDir: string): void {
  const had = (readHarnessConfig(projectDir)?.bddCmd || "").trim();
  if (had) return;
  const cmd = bddCommandFor(projectDir);
  if (cmd) writeHarnessCommand(projectDir, "bdd_cmd", cmd);
}

/**
 * What the gate requires, written with the project (issue #494): the standard
 * preset, every rule on its own line to change. Locally and in CI alike, so
 * `--no-ci` still writes it; a policy already there is never touched. A
 * project without the file keeps the strict gate it always had.
 */
function installPolicy(projectDir: string, opts: { dryRun: boolean }) {
  const file = path.join(projectDir, GATE_POLICY_FILE);
  if (fs.existsSync(file)) return;
  if (opts.dryRun) {
    logInfo(`[dry-run] write ${GATE_POLICY_FILE} (what the gate requires: the standard preset)`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Required only with a runner to run them, set or found from the stack (REQ-663).
  let set = "";
  try {
    set = (readHarnessConfig(projectDir)?.bddCmd || "").trim();
  } catch {
    // a config migrate has yet to fix: the stack decides
  }
  const runner = !!set || !!bddCommandFor(projectDir);
  fs.writeFileSync(file, gatePolicyTemplate({ bdd: runner }), "utf8");
  logInfo(`🚦 Policy: ${GATE_POLICY_FILE} — the standard preset; edit a rule to change what fails`);
}
