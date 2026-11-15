import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import {
  listDeltas,
  paths,
  readConfig,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseDelta } from "../../../../packages/core/src/domain/SpecParser";
import { questionTable } from "../../../../packages/core/src/domain/Clarification";
import {
  renderReviewPage,
  type ReviewRequirement,
} from "../../../../packages/core/src/domain/ReviewPage";

const NULL_SHAPE = { review: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n  specgate review <change> [--out <file>] [--project-dir <path>] [--json]\n\n" +
      "Writes one HTML page of a change for people who do not read the repository: its\n" +
      "intent, each requirement's title, text, status and scenarios as plain steps, its\n" +
      "open questions and assumptions, and the date and commit it was made from. The page\n" +
      "loads nothing from outside the file, so it opens from a mail attachment, offline.\n" +
      "Default output: <change>-review.html.\n\n" +
      "Exit 0 done · 1 no such change · 2 usage error.\n"
  );
}

const read = (file: string) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

/** The first paragraph under `## Intent`, on one line. */
function intentOf(proposal: string): string {
  const lines = proposal.replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((l) => /^##\s+Intent\b/i.test(l));
  if (at === -1) return "";
  const para: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (line.trim() === "") {
      if (para.length) break;
      continue;
    }
    para.push(line.trim());
  }
  return para.join(" ");
}

/** The second cell of each row of the first table: the assumption itself. */
function assumptionLines(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    if (/^#$/.test(cells[0]) || !cells[1]) continue;
    out.push(cells[1]);
  }
  return out;
}

/** `specgate review` (REQ-551). */
export class ReviewCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "review" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let out = "";
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--out") out = argv[++i] || "";
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for review: ${a}`, { fix: "specgate review --help" }),
        ]);
      } else words.push(a);
    }
    if (words.length !== 1) {
      io.usage(NULL_SHAPE, [
        error("review_usage", "review takes one change.", { fix: "specgate review <change>" }),
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
    const proposal = read(path.join(dir, "proposal.md"));
    const requirements: ReviewRequirement[] = listDeltas(projectDir, change).flatMap((d) => {
      const delta = parseDelta(read(d.file));
      return [...delta.added, ...delta.modified].map((r) => ({
        id: r.id || "",
        title: r.name.replace(/^REQ-\d+\s*[—:-]\s*/, "").trim(),
        text: Array.isArray(r.text) ? r.text.join("\n") : r.text,
        status: String((r.trace as Record<string, unknown>)?.status || "Draft"),
        scenarios: r.scenarios.map((s) => ({
          title: (s.name || s.heading).replace(/^SCN-\w+\s*[—:-]\s*/, ""),
          steps: s.steps,
        })),
      }));
    });
    const commit = spawnSync("git", ["-C", projectDir, "rev-parse", "HEAD"], { encoding: "utf8" });
    const page = renderReviewPage({
      change,
      title: (/^#\s+(.+)$/m.exec(proposal)?.[1] || change).replace(/^Proposal:\s*/i, ""),
      intent: intentOf(proposal),
      kind: String(readConfig(projectDir, change).kind || ""),
      requirements,
      questions: questionTable(read(path.join(dir, "questions.md"))).map((q) => ({
        id: q.id,
        text: q.text,
        answered: q.answered,
      })),
      assumptions: assumptionLines(read(path.join(dir, "assumptions.md"))),
      date: new Date().toISOString().slice(0, 10),
      commit: commit.status === 0 ? commit.stdout.trim() : "",
    });
    const rel = out || `${change}-review.html`;
    const file = path.resolve(projectDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page, "utf8");
    io.emit({ review: { change, path: rel, requirements: requirements.length } }, () =>
      process.stdout.write(
        ui.header("review", change) +
          ui.fileLine("added", rel, `${requirements.length} requirement(s)`) +
          `  ${ui.muted("One file, nothing loaded from outside it: send it as an attachment.")}\n\n`
      )
    );
  }
}
