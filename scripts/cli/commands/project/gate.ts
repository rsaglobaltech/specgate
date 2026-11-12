import * as ui from "../../../lib/ui";
import { writeGate } from "../config/CiInitCommand";

function logInfo(msg: string) {
  process.stdout.write(ui.logLine(msg));
}

/**
 * The spec gate, installed with the project (REQ-455): the full gate of
 * `specgate ci init`, version pinned, for the provider the folder shows —
 * GitHub when it shows none. `--no-ci` leaves it out.
 */
export function installGate(projectDir: string, opts: { dryRun: boolean; noCi?: boolean }) {
  if (opts.noCi) {
    logInfo("🚦 No CI file (--no-ci) — add the gate later with `specgate ci init`");
    return;
  }
  if (opts.dryRun) {
    // What the write would do, so the dry run lists only what is written (REQ-489).
    const would = writeGate(projectDir, { dryRun: true });
    logInfo(
      would.written
        ? `[dry-run] write ${would.dest} (the spec gate; --no-ci leaves it out)`
        : `🚦 CI: ${would.dest} kept as it is`
    );
    return;
  }
  const gate = writeGate(projectDir);
  logInfo(
    gate.written
      ? `🚦 CI: ${gate.dest} — the spec gate; \`specgate ci status\` says what it checks`
      : `🚦 CI: ${gate.dest} kept as it is`
  );
}
