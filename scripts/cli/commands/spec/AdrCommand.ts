import * as fs from "node:fs";
import * as path from "node:path";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson, type AgentIo } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import {
  ADR_DIR,
  adrSlug,
  isAdrFile,
  nextAdrNumber,
  readAdr,
  renderAdr,
  supersededText,
} from "../../../../packages/core/src/domain/Adr";

const NULL_SHAPE = { adr: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      '  specgate adr new "<title>" [--project-dir <path>] [--json]\n' +
      '  specgate adr supersede <NNNN> "<title>" [--project-dir <path>] [--json]\n' +
      "  specgate adr list [--project-dir <path>] [--json]\n\n" +
      "Architecture decisions in docs/specs/adr/, numbered NNNN-<slug>.md.\n\n" +
      "new writes the next one: Proposed, dated, with Context, Decision and Consequences.\n" +
      "supersede writes a new one that names the old, and changes one line of the old:\n" +
      "its status, to `Superseded by NNNN`. A decision is replaced, never rewritten.\n" +
      "list shows every ADR with its number, title and status.\n\n" +
      "Exit 0 done · 1 failed · 2 usage error.\n"
  );
}

export class AdrCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "adr" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for adr: ${a}`, { fix: "specgate adr --help" }),
        ]);
      } else words.push(a);
    }
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    const dir = path.join(projectDir, ADR_DIR);
    const [verb, ...rest] = words;
    if (verb === "list") return this.list(io, dir);
    if (verb === "new" && rest.length === 1 && rest[0].trim()) {
      return this.write(io, projectDir, dir, rest[0].trim());
    }
    if (verb === "supersede" && rest.length === 2 && rest[1].trim()) {
      return this.supersede(io, dir, rest[0], rest[1].trim());
    }
    io.usage(NULL_SHAPE, [
      error("adr_usage", 'adr takes new "<title>", supersede <NNNN> "<title>", or list.', {
        fix: "specgate adr --help",
      }),
    ]);
  }

  private files(dir: string): string[] {
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter(isAdrFile).sort() : [];
  }

  private list(io: AgentIo, dir: string): void {
    const adrs = this.files(dir).map((f) => readAdr(f, fs.readFileSync(path.join(dir, f), "utf8")));
    io.emit({ adr: { list: adrs } }, () => {
      process.stdout.write(ui.header("adr list", ADR_DIR));
      if (adrs.length === 0)
        process.stdout.write(
          ui.info("No ADR yet.") +
            ui.next('specgate adr new "<title>"', "records the first decision")
        );
      for (const a of adrs) {
        process.stdout.write(
          `  ${a.number}  ${a.title.padEnd(56)} ${ui.muted(a.status || "no status")}\n`
        );
      }
      process.stdout.write("\n");
    });
  }

  /** Write the next ADR; returns its file name. */
  private create(dir: string, title: string, supersedes?: string): string {
    const number = nextAdrNumber(this.files(dir));
    const file = `${number}-${adrSlug(title)}.md`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, file),
      renderAdr(number, title, new Date().toISOString().slice(0, 10), supersedes),
      "utf8"
    );
    return file;
  }

  private write(io: AgentIo, projectDir: string, dir: string, title: string): void {
    const file = this.create(dir, title);
    const rel = `${ADR_DIR}/${file}`;
    io.emit(
      { adr: { created: readAdr(file, fs.readFileSync(path.join(dir, file), "utf8")), path: rel } },
      () =>
        process.stdout.write(
          ui.header("adr new", path.basename(projectDir)) +
            ui.fileLine("added", rel) +
            ui.next(
              `$EDITOR ${rel}`,
              "write its context, decision and consequences; set Accepted once agreed"
            )
        )
    );
  }

  private supersede(io: AgentIo, dir: string, old: string, title: string): void {
    const number = old.replace(/^ADR-?/i, "").padStart(4, "0");
    const oldFile = this.files(dir).find((f) => f.startsWith(`${number}-`));
    if (!oldFile) {
      io.fail(NULL_SHAPE, [
        error("adr_not_found", `No ADR ${number} in ${ADR_DIR}.`, {
          target: number,
          fix: "specgate adr list",
        }),
      ]);
      return;
    }
    const oldPath = path.join(dir, oldFile);
    const before = fs.readFileSync(oldPath, "utf8");
    const was = readAdr(oldFile, before);
    if (/^superseded/i.test(was.status)) {
      io.fail(NULL_SHAPE, [
        error("adr_already_superseded", `ADR ${number} is already ${was.status}.`, {
          target: number,
          fix: "Supersede the ADR that replaced it instead.",
        }),
      ]);
      return;
    }
    // Checked before anything is written: no half-done supersession.
    if (supersededText(before, "0000") === null) {
      io.fail(NULL_SHAPE, [
        error("adr_status_missing", `${ADR_DIR}/${oldFile} has no Status line to change.`, {
          target: number,
          fix: "Add a `**Status:** Accepted` line under its title, then supersede it.",
        }),
      ]);
      return;
    }
    const file = this.create(dir, title, number);
    const by = file.slice(0, 4);
    fs.writeFileSync(oldPath, supersededText(before, by)!, "utf8");
    const created = readAdr(file, fs.readFileSync(path.join(dir, file), "utf8"));
    io.emit(
      {
        adr: {
          created,
          path: `${ADR_DIR}/${file}`,
          superseded: readAdr(oldFile, fs.readFileSync(oldPath, "utf8")),
        },
      },
      () =>
        process.stdout.write(
          ui.header("adr supersede", `${number} → ${by}`) +
            ui.fileLine("added", `${ADR_DIR}/${file}`) +
            ui.fileLine("changed", `${ADR_DIR}/${oldFile}`, `Superseded by ${by}`) +
            ui.next(`$EDITOR ${ADR_DIR}/${file}`, `say what changed since ADR-${number}`)
        )
    );
  }
}
