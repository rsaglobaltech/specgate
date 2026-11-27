import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { forShell } from "../../../lib/shell-command";
import { keepBefore, scenarioCommand } from "../../../lib/evidence";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

const NULL_SHAPE = { evidence: null };
const REQ = /^REQ-[A-Za-z0-9.]+$/;

function usage(): void {
  process.stdout.write(
    `
  📸 ${c.bold}specgate evidence before${c.reset} <REQ>… [--project-dir <dir>] [--json]

  What a flow did before the change (ADR-0047). Runs each requirement's
  scenarios through bdd_cmd, with {tags} as @<REQ>, on the code as it is, and
  keeps the run in .specgate/evidence/<REQ>/before/ — its command, exit code,
  output, and what the runner wrote under test-results/ (screenshots, video,
  traces; kept out of git). Take it once the test is written and before the
  code: red is expected. apply keeps the after beside it.
`
  );
}

export class EvidenceCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for evidence: ${a}`, {
            fix: "specgate evidence --help",
          }),
        ]);
    }
    const [sub, ...ids] = positional;
    if (sub !== "before" || ids.length === 0 || !ids.every((id) => REQ.test(id))) {
      io.usage(NULL_SHAPE, [
        error(
          "evidence_usage",
          sub === "before"
            ? `evidence before takes requirement ids: ${ids.join(" ") || "none given"}.`
            : "evidence takes `before <REQ>…`.",
          { fix: "specgate evidence before REQ-031" }
        ),
      ]);
    }
    this.before(path.resolve(dirArg), ids, io);
  }

  /** REQ-803: each requirement's scenarios, run on the code as it is, kept as its before. */
  private before(dir: string, ids: string[], io: ReturnType<typeof agentIo>): void {
    const bddCmd = (readHarnessConfig(dir)?.bddCmd || "").trim();
    if (!bddCmd) {
      io.fail(NULL_SHAPE, [
        error(
          "evidence_no_runner",
          "No bdd_cmd runs the scenarios, so there is no before to keep.",
          {
            fix: 'specgate config set bdd_cmd "<runs the feature files, with {tags}>"',
          }
        ),
      ]);
    }
    const kept = ids.map((id) => {
      const command = scenarioCommand(bddCmd, id);
      const startedAt = Date.now();
      const r = spawnSync(forShell(command), { cwd: dir, encoding: "utf8", shell: true });
      const run = {
        command,
        exitCode: r.status ?? 1,
        ms: Date.now() - startedAt,
        output: `${r.stdout || ""}${r.stderr || ""}`,
        startedAt,
      };
      return { requirement: id, command, exitCode: run.exitCode, file: keepBefore(dir, id, run) };
    });
    io.emit({ evidence: { before: kept } }, () => {
      process.stdout.write(ui.header("evidence before", ids.join(" ")));
      for (const k of kept) {
        process.stdout.write(
          ui.ok(
            `${k.requirement}: ${k.exitCode === 0 ? "its scenarios pass already" : `red, as before the code (exit ${k.exitCode})`}`
          ) + `     ${ui.muted(`kept in ${k.file}`)}\n`
        );
      }
      process.stdout.write(ui.next(`specgate apply ${ids[0]}`, "once the code makes them pass"));
    });
  }
}
