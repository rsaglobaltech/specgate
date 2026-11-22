import { bddCommandFor, requireBdd, syncApprovedChanges } from "../../../lib/bdd";
import {
  readHarnessConfig,
  writeHarnessCommand,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import {
  MIGRATION_REPORT,
  actionJson,
  applyMigration,
  describeAction,
  dirtyTreeProblem,
  planMigration,
  renderReport,
} from "../../../lib/migrate";

const NULL_SHAPE = { migrate: null };

function usage(): void {
  process.stdout.write(
    `
  🧭 ${c.bold}specgate migrate${c.reset} 1.0 [--dry-run] [--json] [--project-dir <dir>]

  Moves a 0.27 project to 1.0: each open change into the three layers
  (discover.md, design.md, tasks.md), the configuration versions that changed,
  and a report of what is left to you (${MIGRATION_REPORT.split(path.sep).join("/")}).
  Archived changes are never rewritten. Runs on a committed tree; --dry-run
  changes nothing and prints the same report.
`
  );
}

export class MigrateCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    let dirArg = ".";
    let dryRun = false;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--dry-run") dryRun = true;
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for migrate: ${a}`, {
            fix: "specgate migrate --help",
          }),
        ]);
    }
    // REQ-663: executable scenarios, required from now on.
    if (positional[0] === "bdd") {
      const dir = path.resolve(dirArg);
      const cmd = bddCommandFor(dir);
      const wrote = dryRun ? false : requireBdd(dir);
      const had = (readHarnessConfig(dir)?.bddCmd || "").trim();
      if (!dryRun && cmd && !had) writeHarnessCommand(dir, "bdd_cmd", cmd);
      const features = dryRun ? [] : syncApprovedChanges(dir);
      io.emit(
        { migrate: { target: "bdd", dryRun, required: true, bddCmd: had || cmd, features } },
        () => {
          const out = (s: string) => process.stdout.write(s);
          out(ui.header("migrate", dryRun ? "bdd · dry run" : "bdd"));
          out(
            ui.ok(
              `${wrote || dryRun ? "bdd: required" : "bdd was required already"} — the scenarios run before any code.`
            ) + "\n"
          );
          out(
            had || cmd
              ? `  bdd_cmd: ${had || cmd}\n`
              : '  bdd_cmd: set it — specgate config set bdd_cmd "<runs the feature files, with {tags}>"\n'
          );
          for (const f of features) out(`  + ${f}\n`);
        }
      );
      return;
    }
    if (positional[0] !== "1.0") {
      io.usage(NULL_SHAPE, [
        error(
          "migrate_target",
          `migrate knows two targets: 1.0 and bdd (got ${positional[0] || "none"}).`,
          {
            fix: "specgate migrate 1.0 --dry-run",
          }
        ),
      ]);
    }
    const dir = path.resolve(dirArg);

    // REQ-327: a real run starts from a commit, so git undoes it.
    if (!dryRun) {
      const problem = dirtyTreeProblem(dir);
      if (problem) {
        io.fail(NULL_SHAPE, [
          problem === "not-git"
            ? error("migrate_not_git", `${dir} is not in a git repository.`, {
                fix: "git init && git add -A && git commit -m 'before 1.0', then specgate migrate 1.0",
              })
            : error("migrate_dirty_tree", "The project has uncommitted changes.", {
                fix: "Commit or stash them first (git stash), then specgate migrate 1.0 — or preview with --dry-run.",
              }),
        ]);
      }
    }

    const planned = planMigration(dir);
    const total = planned.reduce((n, s) => n + s.actions.length, 0);
    const manual = planned.flatMap((s) => s.manual).map((m) => m.split(path.sep).join("/"));
    let applied = 0;
    // REQ-326: nothing to do, nothing written — the report of the run that did it stays.
    if (!dryRun && total > 0) {
      applied = applyMigration(dir, planned);
      const date = new Date().toISOString().slice(0, 10);
      const report = path.join(dir, MIGRATION_REPORT);
      fs.mkdirSync(path.dirname(report), { recursive: true });
      fs.writeFileSync(report, renderReport(planned, date), "utf8");
    }

    const payload = {
      migrate: {
        target: "1.0",
        dryRun,
        applied,
        nothingToDo: total === 0,
        report: !dryRun && total > 0 ? MIGRATION_REPORT.split(path.sep).join("/") : null,
        steps: planned.map((s) => ({
          id: s.id,
          title: s.title,
          actions: s.actions.map(actionJson),
          manual: s.manual.map((m) => m.split(path.sep).join("/")),
        })),
        manual,
      },
    };
    io.emit(payload, () => {
      const out = (s: string) => process.stdout.write(s);
      out(ui.header("migrate", dryRun ? "1.0 · dry run" : "1.0"));
      if (total === 0) {
        out(ui.ok("Nothing left to migrate: the project is on 1.0.") + "\n");
        return;
      }
      for (const s of planned) {
        out(ui.section(s.title));
        if (s.actions.length === 0) out(`    ${ui.muted("nothing to change")}\n`);
        for (const a of s.actions)
          out(`    ${describeAction(a, dryRun ? "planned" : "done").replace(/`/g, "")}\n`);
        out("\n");
      }
      if (manual.length) {
        out(ui.section("Still to do"));
        for (const m of manual) out(`    · ${m}\n`);
        out("\n");
      }
      out(
        dryRun
          ? `  ${ui.muted("Nothing was changed. Run it without --dry-run on a committed tree.")}\n\n`
          : ui.ok(`${applied} change(s) made · report in ${payload.migrate.report}`) +
              `     ${ui.muted("Review them, then commit.")}\n\n`
      );
    });
  }
}
