#!/usr/bin/env node

/**
 * `specgate harness stop --after-current` — ask the harness run working in
 * this project to finish the requirement in progress and start no other
 * (REQ-491). The run says so in its JSON result, under `stopped`.
 */

import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { error } from "../lib/diagnostics";
import { stopAfterCurrent, stopNow } from "../lib/harness-guard";
import * as ui from "../lib/ui";

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness stop --after-current [--project-dir <path>] [--json]\n" +
      "  specgate harness stop --now [--project-dir <path>] [--json]\n\n" +
      "Asks the harness run working in this project to finish the requirement in\n" +
      "progress and start no other. The rest are reported as not attempted, and the\n" +
      "run's JSON result says it stopped by request (`stopped.by`: `request`).\n" +
      "Nothing is killed: the run reads the request between requirements.\n\n" +
      "--now ends the run at once, with every command it started — its agents\n" +
      "among them. The requirement in progress keeps its worktree, and resuming\n" +
      "the run continues it.\n"
  );
}

export function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { stop: null };
  let projectDir = ".";
  let afterCurrent = false;
  let now = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
    else if (a === "--after-current") afterCurrent = true;
    else if (a === "--now") now = true;
    else if (a === "--json") continue;
    else if (a === "--format") i += 1;
    else {
      io.usage(shape, [
        error("usage", `Unknown argument: ${a}`, { fix: "specgate harness stop --help" }),
      ]);
    }
  }
  if (afterCurrent === now) {
    io.usage(shape, [
      error(
        "missing_argument",
        "Say when the run should stop: after the requirement in progress, or now.",
        { fix: "specgate harness stop --after-current   (or --now)" }
      ),
    ]);
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
  const answer = now ? stopNow(dir) : stopAfterCurrent(dir);
  io.emit({ ...answer }, () => {
    if (answer.stop.run && answer.stop.now) {
      process.stdout.write(
        ui.ok(
          `Ended the run (pid ${answer.stop.run.pid}) and every command it started; ` +
            "`specgate harness run --resume` continues it."
        )
      );
    } else if (answer.stop.run) {
      const run = answer.stop.run;
      process.stdout.write(
        ui.ok(`Asked the run (pid ${run.pid}) to stop after the requirement in progress.`)
      );
    } else {
      process.stdout.write(ui.info("No harness run is working in this project: nothing to stop."));
    }
  });
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
