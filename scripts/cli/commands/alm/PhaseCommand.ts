/**
 * `specgate alm phase <change>` and `specgate alm move <change> [<phase>]`
 * (REQ-309) — what an agent needs to drive the board: read where a change
 * stands without the network, and move its ticket there.
 */

import { resolveProjectDir } from "../../../lib/project-root";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { readAlmConfig } from "../../../alm/core";
import { makeClient } from "../../../alm/clients";
import { PHASES } from "../../../alm/port";
import type { Phase } from "../../../alm/port";
import { boardChanges, movePhase, readPhaseMap, writePhaseMap } from "../../../alm/phases";
import * as ui from "../../../lib/ui";

interface Options {
  projectDir: string;
  json: boolean;
  positional: string[];
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { projectDir: ".", json: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    } else opts.positional.push(a);
  }
  return opts;
}

/** `alm phase <change>`: the phase, the ticket and the board state last set. No network. */
export async function phaseMain(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const io = agentIo(opts.json || wantsJson(argv));
  const nullShape = { phase: null };
  const id = opts.positional[0];
  const projectDir = resolveProjectDir(opts.projectDir);
  const change = boardChanges(projectDir).find((c) => c.id === id);
  if (!change) {
    return io.fail(nullShape, [
      error("change_not_found", `No change ${id || "(none)"}.`, {
        target: id,
        fix: "specgate alm phase <change-id> — see specgate change list.",
      }),
    ]);
  }
  const record = readPhaseMap(projectDir)[change.id];
  const phase = {
    change: change.id,
    phase: change.phase,
    ticket: change.ticket,
    state: record && record.phase === change.phase ? (record.state ?? null) : null,
    requirements: change.requirements,
  };
  io.emit({ phase }, () =>
    process.stdout.write(
      ui.header("alm phase", change.id) +
        `  ${change.phase}  ${change.ticket ?? ui.muted("no ticket")}  ${
          phase.state ? `board: ${phase.state}` : ui.muted("not on the board yet")
        }\n\n`
    )
  );
}

/** `alm move <change> [<phase>]`: move the change's ticket to its phase, or the one named. */
export async function moveMain(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const io = agentIo(opts.json || wantsJson(argv));
  const nullShape = { move: null };
  const [id, named] = opts.positional;
  if (named && !PHASES.includes(named as Phase)) {
    return io.fail(nullShape, [
      error("phase_unknown", `"${named}" is not a phase.`, {
        target: named,
        fix: `One of: ${PHASES.join(", ")}.`,
      }),
    ]);
  }
  try {
    const projectDir = resolveProjectDir(opts.projectDir);
    const change = boardChanges(projectDir).find((c) => c.id === id);
    if (!change) {
      return io.fail(nullShape, [
        error("change_not_found", `No change ${id || "(none)"}.`, {
          target: id,
          fix: "specgate alm move <change-id> [<phase>]",
        }),
      ]);
    }
    if (!change.ticket) {
      return io.fail(nullShape, [
        error("change_no_ticket", `${change.id} has no ticket to move.`, {
          target: change.id,
          fix: "Add ticket: <KEY> to its change.yaml.",
        }),
      ]);
    }
    const cfg = readAlmConfig(projectDir);
    const client = makeClient(cfg, undefined, projectDir);
    const map = readPhaseMap(projectDir);
    const action = await movePhase({ ...change, ticket: change.ticket }, map, client, cfg, {
      phase: (named as Phase) || undefined,
      force: true,
    });
    if (action.action === "phase-unsupported") {
      return io.fail(nullShape, [
        error("alm_phase_unsupported", action.detail || "", { target: cfg.provider }),
      ]);
    }
    writePhaseMap(projectDir, map, false);
    const move = {
      change: change.id,
      issue: action.issue,
      phase: action.phase,
      state: action.state,
    };
    io.emit({ move }, () =>
      process.stdout.write(
        ui.header("alm move", change.id) + ui.ok(`${action.issue} → ${action.state}`) + "\n"
      )
    );
  } catch (e) {
    return io.fail(nullShape, [error("alm_move_error", (e as Error).message || String(e))]);
  }
}
