import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import * as ui from "../../../lib/ui";
import { refreshDerivedMatrix } from "./MatrixCommand";
import { summarise, nextCommandPlain, nextReason } from "./StatusCommand";
import { briefProgress } from "./DraftCommand";
import { PetView, petView, readPetState, fullPet } from "../../../pet/pet";

/** The cat for a project, from what `status` already reads. Null when there is no project. */
export function petFor(projectDir: string, summary?: any): PetView | null {
  if (!summary) {
    const trace = path.join(projectDir, "docs/specs/traceability.md");
    if (!fs.existsSync(trace)) return null;
    refreshDerivedMatrix(projectDir);
    summary = summarise(projectDir, fs.readFileSync(trace, "utf8"));
    try {
      summary.brief = briefProgress(projectDir);
    } catch {
      summary.brief = null;
    }
  }
  return petView({
    total: summary.counts.total,
    done: summary.counts.DONE,
    readyToClose: summary.counts.NEEDS_STATUS_UPDATE || 0,
    waiting: summary.counts.WAITING_FOR_ANSWER || 0,
    state: readPetState(projectDir),
    next: nextCommandPlain(summary),
    reason: nextReason(summary),
  });
}

const USAGE =
  "\n  specgate pet [--project-dir <dir>] [--json]\n\n" +
  "  Gato, the cat that keeps the gate. Its state is the project's: fed by closed\n" +
  "  requirements, healthy while `check` is green, worried by open questions.\n" +
  "  It shows up at the end of `status` too; `specgate config set pet off` hides it.\n\n";

export class PetCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "pet" ? this.args.slice(1) : this.args;
    const io = agentIo(wantsJson(argv));
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(USAGE);
      return;
    }
    const at = argv.indexOf("--project-dir");
    const projectDir = resolveProjectDir(at >= 0 ? argv[at + 1] || "." : ".");
    const view = petFor(projectDir);
    if (!view) {
      io.fail({ pet: null }, [
        error("pet_no_project", "No spec-driven project here, so no cat to keep.", {
          fix: "Run `specgate init` — the cat hatches from the first requirement you close.",
        }),
      ]);
    }
    io.emit({ pet: view }, () =>
      process.stdout.write(
        ui.header("pet", path.basename(projectDir)) +
          fullPet(view!) +
          ui.next(view!.next, view!.reason)
      )
    );
  }
}
