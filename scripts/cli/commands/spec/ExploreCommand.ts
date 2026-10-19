import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { withQueue, needsOf } from "./StatusCommand";
import { inFlightRequirements } from "../../../lib/in-flight";
import { openQuestions } from "../../../../packages/core/src/domain/DraftChecklist";
import { runConfinedAgent } from "../../../draft/confined-agent";
import * as ui from "../../../lib/ui";

/**
 * `specgate explore` — thinking with the agent before a change exists
 * (ADR-0037).
 *
 * A brief of where the project stands — requirements by state, the open
 * changes and what they add, the questions still open — and the person's
 * question. Nothing is written: with `--agent`, the agent gets the brief and
 * anything it writes in the project is undone, and said.
 */

const NULL_SHAPE = { explore: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      '  specgate explore ["<question>"] [--agent "<cmd>"] [--project-dir <path>] [--json]\n\n' +
      "A brief for thinking with an agent before a change exists: the requirements by\n" +
      "state, the open changes and their requirements, the open questions, and your\n" +
      "question. Writes nothing. With --agent, the agent gets the brief (on standard\n" +
      "input, or in a file if the command contains {prompt_file}) and whatever it\n" +
      "writes in the project is undone — the output names it. Needs git for --agent.\n" +
      "When you know what to change: specgate propose <change-id>.\n"
  );
}

function questionsIn(projectDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "archive") walk(full);
      else if (e.name === "questions.md") {
        for (const q of openQuestions(fs.readFileSync(full, "utf8"))) {
          found.push(`${q.row}${q.blocks.length ? ` (blocks ${q.blocks.join(", ")})` : ""}`);
        }
      }
    }
  };
  walk(path.join(projectDir, "docs", "specs", "changes"));
  return found;
}

export function exploreBrief(projectDir: string, question: string) {
  const queue = withQueue(
    projectDir,
    (summary) => ({
      counts: summary.counts,
      pending: summary.items
        .filter((it) => it.category !== "DONE")
        .slice(0, 20)
        .map((it) => ({
          id: it.requirement,
          title: String(it.title || "").replace(/^UC-\d+\s*/, ""),
          needs: needsOf(it),
          ...(it.change ? { change: it.change } : {}),
        })),
    }),
    { write: false }
  );
  const changes: Record<string, string[]> = {};
  for (const r of inFlightRequirements(projectDir)) {
    (changes[r.change] = changes[r.change] || []).push(`${r.id} (${r.status})`);
  }
  const questions = questionsIn(projectDir);
  const text =
    `# Explore${question ? `: ${question}` : ""}\n\n` +
    "Think this through with the person before anything is written. Do not edit files: " +
    "anything written in the project is undone. Answer with the options, their trade-offs, " +
    "the requirements each one touches, and the questions to settle first.\n\n" +
    `## Where the project stands\n\n` +
    `- ${queue.counts.total} requirements: ${queue.counts.DONE} done, ` +
    `${queue.counts.total - queue.counts.DONE} not yet.\n` +
    (queue.pending.length
      ? queue.pending
          .map(
            (p) =>
              `- ${p.id}${p.title ? ` — ${p.title}` : ""}: needs ${p.needs || "work"}${p.change ? ` (change ${p.change})` : ""}`
          )
          .join("\n") + "\n"
      : "") +
    `\n## Open changes\n\n` +
    (Object.keys(changes).length
      ? Object.entries(changes)
          .map(([c, reqs]) => `- ${c}: ${reqs.join(", ")}`)
          .join("\n") + "\n"
      : "- none\n") +
    `\n## Open questions\n\n` +
    (questions.length ? questions.map((q) => `- ${q}`).join("\n") + "\n" : "- none\n") +
    (question ? `\n## The question\n\n${question}\n` : "") +
    `\nThe specification is in spec.md and docs/specs/capabilities/; open changes are in ` +
    `docs/specs/changes/. When a direction is chosen: specgate propose <change-id>.\n`;
  return { question, counts: queue.counts, changes, questions, text };
}

export class ExploreCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    let agent = "";
    let dirArg = ".";
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--agent") agent = argv[++i] || "";
      else if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for explore: ${a}`, {
            fix: "specgate explore --help",
          }),
        ]);
      } else words.push(a);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch (err) {
      // `resolveProjectDir` throws Errors.
      io.usage(NULL_SHAPE, [
        error("project_not_found", (err as Error).message, {
          fix: "Run from inside a spec-driven project, or pass --project-dir.",
        }),
      ]);
      return;
    }
    const brief = exploreBrief(projectDir, words.join(" ").trim());

    if (!agent) {
      io.emit({ explore: { ...brief, agent: null } }, () => process.stdout.write(brief.text));
      return;
    }

    if (!json)
      process.stdout.write(ui.header("explore", brief.question || path.basename(projectDir)));
    const run = runConfinedAgent({
      projectDir,
      changeId: "explore",
      allowed: () => false,
      command: agent,
      prompt: brief.text,
      showOutput: !json,
    });
    if (run.problem === "no_git") {
      io.fail(NULL_SHAPE, [
        error(
          "explore_needs_git",
          "--agent needs a git repository to undo what the agent writes.",
          {
            fix: "git init, or run specgate explore without --agent and paste the brief yourself",
          }
        ),
      ]);
    }
    if (run.reverted.length > 0 && !json) {
      process.stdout.write(
        "\n" + ui.warn(`Undone — explore writes nothing: ${run.reverted.join(", ")}`)
      );
    }
    if (!run.ok) {
      io.fail(NULL_SHAPE, [
        error("explore_agent_failed", `The agent ${run.detail || "failed"}.`, {
          fix: "Check the agent command on its own, then run specgate explore again",
        }),
      ]);
    }
    io.emit({ explore: { ...brief, agent, undone: run.reverted } }, () =>
      process.stdout.write(ui.next("specgate propose <change-id>", "once a direction is chosen"))
    );
  }
}
