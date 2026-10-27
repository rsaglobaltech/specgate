import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson, type AgentIo, type AgentDocument } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { appendEvent } from "../../../lib/harness-events";
import { answer, ask, reviewed, waiting } from "../../../lib/clarification";
import { briefAdd } from "../../../lib/brief-add";
import {
  EVENTS_ATTEMPT_VAR,
  EVENTS_FILE_VAR,
  EVENTS_REQ_VAR,
} from "../../../../packages/core/src/domain/HarnessEvents";
import * as ui from "../../../lib/ui";

/**
 * `specgate questions`, `specgate answer` and `specgate ask` (REQ-187..189):
 * what waits for an answer, answering it, and asking — for a person, or for
 * the harness's agent, which asks instead of guessing.
 */

interface Parsed {
  words: string[];
  dir: string;
  change?: string;
  reviewed: boolean;
}

function parse(argv: string[], io: AgentIo, shape: AgentDocument, command: string): Parsed {
  const out: Parsed = { words: [], dir: ".", reviewed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir") out.dir = argv[++i] || ".";
    else if (a === "--change") out.change = argv[++i];
    else if (a === "--reviewed") out.reviewed = true;
    else if (a === "--json") continue;
    else if (a.startsWith("-")) {
      io.usage(shape, [
        error("unknown_flag", `Unknown flag for ${command}: ${a}`, {
          fix: `specgate ${command} --help`,
        }),
      ]);
    } else out.words.push(a);
  }
  return out;
}

function project(dir: string, io: AgentIo, shape: AgentDocument): string {
  try {
    return resolveProjectDir(dir);
  } catch (err) {
    return io.usage(shape, [
      error("project_not_found", (err as Error).message, {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }
}

export class QuestionsCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        "Usage:\n  specgate questions [--project-dir <path>] [--json]\n\n" +
          "Everything waiting for an answer: the open questions of every open change and of\n" +
          "docs/specs/questions.md, with what each blocks, and the requirements in\n" +
          "Needs Clarification no open question names. Answer with specgate answer.\n"
      );
      process.exit(0);
    }
    const shape = { questions: null };
    const io = agentIo(wantsJson(argv));
    const p = parse(argv, io, shape, "questions");
    const dir = project(p.dir, io, shape);
    const w = waiting(dir);
    io.emit(
      {
        questions: {
          open: w.questions.map((q) => ({
            id: q.id,
            change: q.change,
            text: q.text,
            blocks: q.blocks,
            file: q.file,
            line: q.line,
          })),
          waitingWithoutQuestion: w.requirements,
        },
      },
      () => {
        process.stdout.write(ui.header("questions"));
        if (w.questions.length === 0 && w.requirements.length === 0) {
          process.stdout.write(ui.ok("Nothing waits for an answer.") + "\n");
          return;
        }
        for (const q of w.questions) {
          process.stdout.write(
            `  ${q.id}  ${ui.muted(q.change)}  ${q.text}\n` +
              `      ${ui.muted(q.blocks.length ? `blocks ${q.blocks.join(", ")}` : "blocks nothing")}` +
              `  ${ui.muted(`→ specgate answer ${q.id} "…"${q.change !== "project" ? ` --change ${q.change}` : ""}`)}\n`
          );
        }
        if (w.requirements.length) {
          process.stdout.write(`\n  ${ui.muted("Needs Clarification with no open question:")}\n`);
          for (const r of w.requirements) {
            process.stdout.write(
              `  ${r.requirement}  ${r.title}  ${ui.muted(`→ specgate ask ${r.requirement} "…"`)}\n`
            );
          }
        }
      }
    );
  }
}

export class AnswerCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        'Usage:\n  specgate answer <Q> "<answer>" [--change <id>] [--project-dir <path>] [--json]\n' +
          "  specgate answer <Q> --reviewed [--change <id>]\n\n" +
          "Writes the answer into the question's row, adds it to assumptions.md as an\n" +
          "assumption to review, and lists the requirements to revise. The draft checklist\n" +
          "waits until --reviewed says the requirements reflect it. --change picks the\n" +
          "change when more than one has that question.\n"
      );
      process.exit(0);
    }
    const shape = { answer: null };
    const io = agentIo(wantsJson(argv));
    const p = parse(argv, io, shape, "answer");
    const [id, ...rest] = p.words;
    const text = rest.join(" ").trim();
    if (!id || (!p.reviewed && !text)) {
      io.usage(shape, [
        error(
          "missing_argument",
          'answer needs a question id and the answer: specgate answer Q4 "…"',
          {
            fix: "specgate questions lists the open ones.",
          }
        ),
      ]);
    }
    const dir = project(p.dir, io, shape);
    if (p.reviewed) {
      const r = reviewed(dir, id, p.change);
      if (!r.ok) io.fail(shape, [error(r.code, r.message, { fix: "specgate questions" })]);
      else
        io.emit({ answer: { question: id, change: r.change, reviewed: r.ids } }, () =>
          process.stdout.write(
            ui.ok(`${r.ids.join(", ")} decided — ${id}'s answer is in the specification.`) + "\n"
          )
        );
      return;
    }
    const r = answer(dir, id, text, p.change);
    if (!r.ok) {
      io.fail(shape, [
        error(r.code, r.message, {
          fix:
            r.changes && r.changes.length > 1 ? `--change ${r.changes[0]}` : "specgate questions",
        }),
      ]);
      return;
    }
    io.emit(
      {
        answer: {
          question: r.question,
          change: r.change,
          assumption: r.assumption,
          revise: r.revise,
        },
      },
      () =>
        process.stdout.write(
          ui.ok(`${r.question} answered in ${r.change}; ${r.assumption} added to review.`) +
            "\n" +
            (r.revise.length
              ? `  Revise ${r.revise.join(", ")} so they say it, then: specgate answer ${r.question} --reviewed\n`
              : `  Then: specgate answer ${r.question} --reviewed\n`)
        )
    );
  }
}

export class AskCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        'Usage:\n  specgate ask <REQ> "<question>" [--project-dir <path>] [--json]\n\n' +
          "Asks instead of guessing: adds the question to the change that defines the\n" +
          "requirement (docs/specs/questions.md when a capability does) and sets it\n" +
          "Needs Clarification. Inside the harness it only records the question: the\n" +
          "harness stops the requirement and writes it into the project.\n"
      );
      process.exit(0);
    }
    const shape = { ask: null };
    const io = agentIo(wantsJson(argv));
    const p = parse(argv, io, shape, "ask");
    const [req, ...rest] = p.words;
    const text = rest.join(" ").trim();
    if (!req || !/^REQ-\d+$/.test(req) || !text) {
      io.usage(shape, [
        error(
          "missing_argument",
          'ask needs a requirement and the question: specgate ask REQ-007 "…"',
          {
            fix: "specgate ask --help",
          }
        ),
      ]);
    }
    // Inside the harness the agent may not edit the specification: the
    // question becomes an event, and the harness writes it (REQ-189).
    const eventsFile = process.env[EVENTS_FILE_VAR];
    if (eventsFile && process.env[EVENTS_REQ_VAR]) {
      appendEvent(
        eventsFile,
        { type: "question", text },
        process.env[EVENTS_REQ_VAR] || req,
        Number(process.env[EVENTS_ATTEMPT_VAR]) || undefined
      );
      io.emit({ ask: { requirement: req, recorded: "harness" } }, () =>
        process.stdout.write(
          ui.ok(
            `Question recorded for ${req}. Stop here: the harness asks the person and ends this attempt.`
          ) + "\n"
        )
      );
      return;
    }
    const dir = project(p.dir, io, shape);
    const r = ask(dir, req, text);
    if (!r.ok) {
      io.fail(shape, [
        error(r.code, r.message, { fix: "specgate status lists the requirements." }),
      ]);
      return;
    }
    io.emit(
      { ask: { requirement: req, change: r.change, question: r.question, file: r.file } },
      () =>
        process.stdout.write(
          ui.ok(`${r.question} added to ${r.file}; ${req} is Needs Clarification.`) +
            "\n" +
            `  Answer with: specgate answer ${r.question} "…"${r.change !== "project" ? ` --change ${r.change}` : ""}\n`
        )
    );
  }
}

export class BriefAddCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        'Usage:\n  specgate brief add <module> "<text>" [--project-dir <path>] [--json]\n\n' +
          "A new requirement for a module the brief lists: appends the line to the brief\n" +
          "under Additions, and adds a requirement quoting it to the module's open change\n" +
          "(draft-<module> or <module>-additions, created when there is none). Its title\n" +
          "and statement are yours to write; specgate draft --check asks for them.\n"
      );
      process.exit(0);
    }
    const shape = { brief: null };
    const io = agentIo(wantsJson(argv));
    const p = parse(argv, io, shape, "brief add");
    const [module, ...rest] = p.words;
    const text = rest.join(" ").trim();
    if (!module || !text) {
      io.usage(shape, [
        error(
          "missing_argument",
          'brief add needs a module and the text: specgate brief add fichas "…"',
          {
            fix: "specgate brief add --help",
          }
        ),
      ]);
    }
    const dir = project(p.dir, io, shape);
    const r = briefAdd(dir, module, text, new Date().toISOString().slice(0, 10));
    if (!r.ok) {
      io.fail(shape, [error(r.code, r.message, { fix: r.fix })]);
      return;
    }
    io.emit(
      {
        brief: {
          module,
          change: r.change,
          requirement: r.requirement,
          created: r.created,
          delta: r.delta,
        },
      },
      () =>
        process.stdout.write(
          ui.ok(`${r.requirement} added to ${r.change}${r.created ? " (new change)" : ""}.`) +
            "\n" +
            `  Write its title, statement and a scenario in ${r.delta}, then: specgate draft --check ${r.change}\n`
        )
    );
  }
}
