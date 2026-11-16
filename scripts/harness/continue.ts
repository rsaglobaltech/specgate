#!/usr/bin/env node

/**
 * `specgate harness continue [--stop]` (REQ-591) — answer a run that paused
 * between attempts (`harness run --pause-between-attempts`): go on with the next
 * attempt, or, with `--stop`, stop retrying the requirement it paused on.
 */

import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { error, warning } from "../lib/diagnostics";
import { answerPause } from "../lib/harness-guard";
import * as ui from "../lib/ui";

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness continue [--stop] [--project-dir <path>] [--json]\n\n" +
      "Answers a harness run paused between attempts: the next attempt starts,\n" +
      "or with --stop the requirement is not retried.\n"
  );
}

export function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { pause: null };
  let projectDir = ".";
  let stop = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
    else if (a === "--stop") stop = true;
    else if (a === "--json") continue;
    else if (a === "--format") i += 1;
    else {
      io.usage(shape, [
        error("usage", `Unknown argument: ${a}`, { fix: "specgate harness continue --help" }),
      ]);
    }
  }
  let dir = "";
  try {
    dir = resolveProjectDir(projectDir, { requireSentinel: true });
  } catch (err) {
    io.fail(shape, [
      error("no_project", err instanceof Error ? err.message : String(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }
  const pause = answerPause(dir, !stop);
  const status = pause
    ? []
    : [
        warning(
          "harness_not_paused",
          "No harness run is paused in this project: nothing to answer.",
          {
            fix: "specgate harness run --pause-between-attempts",
          }
        ),
      ];
  io.emit({ pause: pause ? { ...pause, answer: stop ? "stop" : "go" } : null, status }, () => {
    if (!pause) {
      process.stdout.write(ui.info("No harness run is paused in this project: nothing to answer."));
      return;
    }
    process.stdout.write(
      ui.ok(
        stop
          ? `${pause.requirement}: not retried — the run goes on with the next requirement.`
          : `${pause.requirement}: attempt ${pause.attempt + 1} starts.`
      )
    );
  });
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
