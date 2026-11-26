import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import type { AgentIo } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { parseReviewNotes } from "../../../../packages/core/src/domain/ReviewNotes";
import {
  learnChangeId,
  quoteAttribute,
  lessonsOf,
  type GateFailure,
  type LearnedRule,
  type Lesson,
  type NoteRef,
} from "../../../../packages/core/src/domain/Lessons";

const NULL_SHAPE = { learn: null };
const CHANGES = path.join("docs", "specs", "changes");

function usage(): void {
  process.stdout.write(
    `
  🧭 ${c.bold}specgate learn${c.reset} [--json] [--project-dir <dir>]
     ${c.bold}specgate learn promote${c.reset} <L> --title "<rule>" [--forbid "<regex>" --in "<glob>" | --run "<command>"] [--level warn]

  The lessons that keep coming back (trust curve, phase 4): review notes alike in
  two changes or more, and stages of the gate the agent keeps failing. promote
  opens a change; once a person approves it, the rule is a principle in
  docs/specs/principles.md — an instruction, or a barrier the gate checks.
`
  );
}

/** Every review note of every change, open or archived. */
function allNotes(dir: string): NoteRef[] {
  const out: NoteRef[] = [];
  const read = (changeDir: string, change: string) => {
    const file = path.join(changeDir, "review.md");
    if (!fs.existsSync(file)) return;
    for (const n of parseReviewNotes(fs.readFileSync(file, "utf8"))) {
      out.push({ change, date: n.date, requirement: n.requirement, text: n.text });
    }
  };
  const root = path.join(dir, CHANGES);
  if (!fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === "archive") {
      for (const a of fs.readdirSync(path.join(root, e.name), { withFileTypes: true })) {
        if (a.isDirectory())
          read(path.join(root, e.name, a.name), a.name.replace(/^\d{4}-\d{2}-\d{2}-/, ""));
      }
    } else read(path.join(root, e.name), e.name);
  }
  return out;
}

/** The harness's failed gate stages, one per requirement, attempt and stage. */
function gateFailures(dir: string): GateFailure[] {
  const events = path.join(dir, ".harness", "events");
  if (!fs.existsSync(events)) return [];
  const out: GateFailure[] = [];
  for (const f of fs.readdirSync(events)) {
    if (!/^REQ-[\w-]+\.jsonl$/.test(f)) continue;
    for (const line of fs.readFileSync(path.join(events, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.type === "gate" && e.result === "fail" && typeof e.stage === "string")
          out.push({ req: String(e.req), attempt: Number(e.attempt) || 0, stage: e.stage });
      } catch {
        /* a broken line is no evidence */
      }
    }
  }
  return out;
}

export class LearnCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    const flags: Record<string, string> = {};
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (["--title", "--forbid", "--in", "--run", "--level"].includes(a))
        flags[a.slice(2)] = argv[++i] ?? "";
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for learn: ${a}`, {
            fix: "specgate learn --help",
          }),
        ]);
    }
    const dir = path.resolve(dirArg);
    const lessons = lessonsOf(allNotes(dir), gateFailures(dir));
    if (positional[0] === "promote") return this.promote(dir, lessons, positional[1], flags, io);

    io.emit({ learn: { lessons } }, () => {
      const out = (s: string) => process.stdout.write(s);
      out(ui.header("learn", `${lessons.length} lesson(s)`));
      if (!lessons.length)
        out(
          `  ${ui.muted("Nothing comes back yet: no review note repeats, no gate stage keeps failing.")}\n\n`
        );
      for (const l of lessons) {
        out(
          `  ${c.bold}${l.id}${c.reset}  ${l.kind === "review" ? "review notes" : `the agent fails ${l.stage}`} ${ui.muted(`· ${l.count} time(s)`)}\n`
        );
        if (l.evidence)
          for (const n of l.evidence) out(`     ${ui.muted(`${n.change}:`)} ${n.text}\n`);
        if (l.requirements) out(`     ${ui.muted(l.requirements.join(", "))}\n`);
      }
      if (lessons.length) out(ui.next(lessons[0].next, "a person approves the rule"));
    });
  }

  /** REQ-685: the change that carries a lesson as a principle. */
  private promote(
    dir: string,
    lessons: Lesson[],
    id: string | undefined,
    flags: Record<string, string>,
    io: AgentIo
  ) {
    const lesson = lessons.find((l) => l.id === id);
    const title = (flags.title || "").trim();
    if (!lesson || !title) {
      io.fail(NULL_SHAPE, [
        error(
          lesson ? "learn_title_required" : "learn_lesson_unknown",
          lesson
            ? "promote needs the rule's --title."
            : `No lesson ${id ?? ""}: specgate learn lists them.`,
          { fix: 'specgate learn promote L1 --title "<the rule, in a sentence>"' }
        ),
      ]);
      return;
    }
    if (flags.forbid && flags.run) {
      io.fail(NULL_SHAPE, [
        error("learn_one_check", "A rule checks a pattern or runs a command, not both.", {
          fix: "Keep --forbid with --in, or --run.",
        }),
      ]);
      return;
    }
    const unquotable = [flags.forbid, flags.in, flags.run].find(
      (v) => v !== undefined && quoteAttribute(v) === null
    );
    if (unquotable !== undefined) {
      io.fail(NULL_SHAPE, [
        error("learn_value_quotes", `A rule's value holds both " and ': ${unquotable}`, {
          fix: 'Write it with one kind of quote, or match the other with a character class (["]).',
        }),
      ]);
      return;
    }
    const changeId = learnChangeId(title);
    const changeDir = path.join(dir, CHANGES, changeId);
    if (fs.existsSync(changeDir)) {
      io.fail(NULL_SHAPE, [
        error("change_exists", `The rule ${changeId} is already proposed.`, {
          fix: `specgate change approve ${changeId}`,
        }),
      ]);
      return;
    }
    const from = lesson.evidence
      ? [...new Set(lesson.evidence.map((n) => n.change))]
      : lesson.requirements || [];
    const rule: LearnedRule = {
      title,
      ...(flags.forbid ? { forbid: flags.forbid, in: flags.in || "**" } : {}),
      ...(flags.run ? { run: flags.run } : {}),
      ...(flags.level === "warn" ? { level: "warn" as const } : {}),
      lesson: lesson.id,
      from,
    };
    const kind = rule.forbid || rule.run ? "a barrier the gate checks" : "an instruction";
    const evidence = lesson.evidence
      ? lesson.evidence.map(
          (n) =>
            `- ${n.date} · ${n.change}${n.requirement ? ` · ${n.requirement}` : ""}: "${n.text}"`
        )
      : [
          `- The gate stage \`${lesson.stage}\` failed ${lesson.count} times, in ${(lesson.requirements || []).join(", ")}.`,
        ];
    const today = new Date().toISOString().slice(0, 10);
    const files: Record<string, string> = {
      "change.yaml": [
        "specgate_change_version: 1",
        "schema: layered",
        `created: ${today}`,
        "rigor: lite",
        "skip_specs: true",
        "retire_capabilities: false",
        `learn_principle: ${JSON.stringify(rule)}`,
        "",
      ].join("\n"),
      "discover.md": [
        `# Discover: ${changeId}`,
        "",
        "## Context",
        "",
        `This keeps coming back (${lesson.id}, ${lesson.count} times):`,
        "",
        ...evidence,
        "",
        "## Use case",
        "",
        `1. A person reads the evidence above, and approves the rule "${title}" as ${kind}.`,
        "",
        "## Acceptance criteria",
        "",
        `- AC-1: docs/specs/principles.md has the rule "${title}" once this change is approved.`,
        "",
      ].join("\n"),
      "design.md": [
        `# Design: ${changeId}`,
        "",
        "## Mechanisms",
        "",
        `- AC-1 — approving the three layers appends "${title}" to docs/specs/principles.md as the next principle${rule.forbid ? `, forbidding \`${rule.forbid}\` in \`${rule.in}\`` : rule.run ? `, passing when \`${rule.run}\` exits 0` : ", in prose"}.`,
        "",
      ].join("\n"),
      "tasks.md": [
        "# Tasks",
        "",
        "## 1. Review",
        "",
        `- [ ] 1.1 Read the evidence, then \`specgate change approve ${changeId}\``,
        "",
      ].join("\n"),
    };
    fs.mkdirSync(changeDir, { recursive: true });
    for (const [f, text] of Object.entries(files))
      fs.writeFileSync(path.join(changeDir, f), text, "utf8");
    const rel = path.relative(dir, changeDir).split(path.sep).join("/");
    io.emit(
      { learn: { promote: { lesson: lesson.id, change: changeId, path: rel, rule } } },
      () => {
        process.stdout.write(
          ui.header("learn promote", lesson.id) +
            ui.ok(`${changeId} opened: "${title}", ${kind}, once a person approves it.`) +
            "\n" +
            Object.keys(files)
              .map((f) => ui.fileLine("added", `${rel}/${f}`))
              .join("") +
            ui.next(
              `specgate change approve ${changeId}`,
              "after reading the evidence in discover.md"
            )
        );
      }
    );
  }
}
