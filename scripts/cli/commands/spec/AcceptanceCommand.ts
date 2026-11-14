import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson, type AgentIo } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { findCliRoot, resolveProjectDir } from "../../../lib/project-root";
import { listDeltas, paths } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseDelta } from "../../../../packages/core/src/domain/SpecParser";
import {
  ACCEPTANCE_FILE,
  acceptanceItems,
  renderAcceptance,
  signatureOf,
  signed,
  type AcceptanceRequirement,
} from "../../../../packages/core/src/domain/Acceptance";

const NULL_SHAPE = { acceptance: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate acceptance <change> [--project-dir <path>] [--json]\n" +
      '  specgate acceptance <change> --sign "<name>" [--project-dir <path>] [--json]\n\n' +
      "Writes docs/specs/changes/<change>/acceptance.md: one unchecked item per scenario,\n" +
      "under its requirement, with its steps. A person checks each item once they have\n" +
      "seen the behaviour, then signs. --sign is refused while an item is unchecked\n" +
      "(acceptance_incomplete); otherwise it records the name and the date, and moves each\n" +
      "of the change's Implemented requirements to Verified.\n\n" +
      "Exit 0 done · 1 refused · 2 usage error.\n"
  );
}

/** The change's requirements and scenarios, from its deltas, with their trace status. */
function changeRequirements(projectDir: string, change: string) {
  const reqs: Array<AcceptanceRequirement & { status: string }> = [];
  for (const d of listDeltas(projectDir, change)) {
    const delta = parseDelta(fs.readFileSync(d.file, "utf8"));
    for (const r of [...delta.added, ...delta.modified]) {
      if (!r.id) continue;
      reqs.push({
        id: r.id,
        title: r.name.replace(/^REQ-\d+\s*[—:-]\s*/, "").trim(),
        status: String((r.trace as Record<string, unknown>)?.status || ""),
        scenarios: r.scenarios.map((s) => ({
          title: s.name || s.heading,
          steps: s.steps,
        })),
      });
    }
  }
  return reqs;
}

/** `specgate acceptance` (REQ-543). */
export class AcceptanceCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "acceptance" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let signer: string | null = null;
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--sign") signer = (argv[++i] || "").trim();
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for acceptance: ${a}`, {
            fix: "specgate acceptance --help",
          }),
        ]);
      } else words.push(a);
    }
    if (words.length !== 1 || signer === "") {
      io.usage(NULL_SHAPE, [
        error("acceptance_usage", "acceptance takes one change, and --sign takes a name.", {
          fix: 'specgate acceptance <change> [--sign "<name>"]',
        }),
      ]);
      return;
    }
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    const change = words[0];
    const dir = paths(projectDir).change(change);
    if (!fs.existsSync(dir)) {
      io.fail(NULL_SHAPE, [
        error("change_not_found", `Change "${change}" does not exist.`, {
          target: change,
          fix: "specgate change list",
        }),
      ]);
      return;
    }
    const file = path.join(dir, ACCEPTANCE_FILE);
    const rel = `docs/specs/changes/${change}/${ACCEPTANCE_FILE}`;
    if (signer === null) return this.write(io, projectDir, change, file, rel);
    return this.sign(io, projectDir, change, file, rel, signer);
  }

  private write(io: AgentIo, projectDir: string, change: string, file: string, rel: string) {
    const existed = fs.existsSync(file);
    if (!existed) {
      fs.writeFileSync(
        file,
        renderAcceptance(change, changeRequirements(projectDir, change)),
        "utf8"
      );
    }
    const items = acceptanceItems(fs.readFileSync(file, "utf8"));
    io.emit(
      {
        acceptance: {
          change,
          path: rel,
          written: !existed,
          checked: items.checked,
          open: items.open,
        },
      },
      () =>
        process.stdout.write(
          ui.header("acceptance", change) +
            (existed
              ? `  ${ui.muted(`${rel} exists — left as it is`)}\n`
              : ui.fileLine("added", rel)) +
            `  ${items.checked} checked · ${items.open.length} open\n` +
            ui.next(
              `specgate acceptance ${change} --sign "<your name>"`,
              "once every item is checked"
            )
        )
    );
  }

  private sign(
    io: AgentIo,
    projectDir: string,
    change: string,
    file: string,
    rel: string,
    name: string
  ) {
    if (!fs.existsSync(file)) {
      io.fail(NULL_SHAPE, [
        error("acceptance_missing", `${rel} does not exist yet.`, {
          fix: `specgate acceptance ${change}`,
        }),
      ]);
      return;
    }
    const md = fs.readFileSync(file, "utf8");
    const already = signatureOf(md);
    if (already) {
      io.fail(NULL_SHAPE, [
        error(
          "acceptance_signed",
          `${rel} is already signed by ${already.name} on ${already.date}.`,
          {
            target: change,
          }
        ),
      ]);
      return;
    }
    const items = acceptanceItems(md);
    if (items.open.length > 0) {
      io.fail({ acceptance: { change, path: rel, open: items.open } }, [
        error(
          "acceptance_incomplete",
          `${items.open.length} item(s) of ${rel} are not checked: ${items.open.join("; ")}.`,
          {
            target: change,
            fix: "Check each item once you have seen it work (- [x]), then sign again.",
          }
        ),
      ]);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(file, signed(md, name, date), "utf8");
    // Acceptance is a person's judgement on top of a gate that already passed
    // at apply; it does not run the gate again.
    const implemented = changeRequirements(projectDir, change)
      .filter((r) => r.status === "Implemented")
      .map((r) => r.id);
    let verified: string[] = [];
    if (implemented.length > 0) {
      const done = spawnSync(
        process.execPath,
        [
          path.join(findCliRoot(__dirname), "bin", "specgate.js"),
          "done",
          ...implemented,
          "--status",
          "Verified",
          "--no-check",
          "--project-dir",
          projectDir,
          "--json",
        ],
        { encoding: "utf8" }
      );
      if (done.status !== 0) {
        io.fail({ acceptance: { change, path: rel, signedBy: name, date } }, [
          error(
            "acceptance_verify_failed",
            `Signed, but ${implemented.join(", ")} could not be set Verified.`,
            {
              fix: `specgate done ${implemented.join(" ")} --status Verified`,
            }
          ),
        ]);
        return;
      }
      verified = implemented;
    }
    io.emit({ acceptance: { change, path: rel, signedBy: name, date, verified } }, () =>
      process.stdout.write(
        ui.header("acceptance --sign", change) +
          ui.ok(`Signed by ${name} on ${date}.`) +
          (verified.length ? ui.info(`Verified: ${verified.join(", ")}`) : "") +
          "\n"
      )
    );
  }
}
