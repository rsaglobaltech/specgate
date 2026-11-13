import * as fs from "node:fs";
import * as path from "node:path";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import {
  NO_WRITE_HINT,
  runConfinedAgent,
  withWritePermission,
} from "../../../draft/confined-agent";
import { moduleFiles, reverseChangeId, reverseModules } from "../../../lib/reverse-modules";
import type { ReverseModule } from "../../../lib/reverse-modules";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import {
  CHANGE_CONFIG_FILE,
  DEFAULT_CONFIG,
  paths,
  renderConfig,
  reserveReqRange,
} from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import {
  REVERSE_ANSWER_FILE,
  parseReverseAnswer,
  renderReverseDelta,
  splitSuspects,
  suspectQuestion,
} from "../../../../packages/core/src/domain/ReverseDraft";
import { addQuestion } from "../../../../packages/core/src/domain/Clarification";
import { ValidateChangeUseCase } from "../../../../packages/core/src/application/ValidateChangeUseCase";
import { DiskProjectRepository } from "../../../../packages/core/src/infrastructure/DiskProjectRepository";

const NULL_SHAPE = { reverse: null };

/** How much source the prompt carries, at most. The agent can read the rest itself. */
const PROMPT_BUDGET = 200_000;

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate reverse --modules [--project-dir <path>] [--json]\n" +
      '  specgate reverse <module> [--agent "<cmd>"] [--project-dir <path>] [--json]\n\n' +
      "Specify a system that already runs, one module at a time.\n\n" +
      "--modules lists the candidates — Maven and Gradle modules, npm workspaces, Go\n" +
      "packages, and the folders under src/ or apps/ that hold code — with their path,\n" +
      "stack and file count. No agent runs.\n\n" +
      "reverse <module> gives your agent (--agent, or agent: in harness.config.yaml)\n" +
      "the module's source, tests and schema files. It answers what the code does, as\n" +
      "requirements with scenarios and the lines each was read from; Specgate writes\n" +
      "them into the change reverse-<module>, every requirement Draft, its trace\n" +
      "citing source=. Behaviour the agent marks as suspect becomes a question in the\n" +
      "change's questions.md, never a requirement. spec.md and the capability specs\n" +
      "are not touched. A change that does not validate is not kept.\n\n" +
      "Needs git: every write outside the answer file is undone.\n\n" +
      "Exit 0 done · 1 failed · 2 usage error.\n"
  );
}

/** The prompt: what to read, what to answer, and where. */
export function reversePrompt(
  projectDir: string,
  mod: ReverseModule,
  answerRel: string,
  files: string[]
): string {
  const out: string[] = [
    `# Reverse the module \`${mod.name}\` (${mod.path}) into requirements`,
    "",
    "Read the code below and describe what it does today, as requirements a product",
    "owner could review. One requirement per business rule, not per class.",
    "",
    `Write ONE file, \`${answerRel}\`, and nothing else. Its shape:`,
    "",
    "```json",
    "{",
    '  "requirements": [',
    "    {",
    '      "title": "An order is cancelled only before it ships",',
    '      "text": "The system SHALL refuse to cancel an order whose status is SHIPPED.",',
    '      "source": ["src/orders/Cancel.java:12"],',
    '      "scenarios": [',
    '        { "title": "A shipped order", "steps": ["GIVEN an order with status SHIPPED", "WHEN its owner cancels it", "THEN the cancellation is refused"] }',
    "      ]",
    "    },",
    "    {",
    '      "title": "A refund rounds down to the cent",',
    '      "text": "The system truncates a refund to two decimals.",',
    '      "source": ["src/orders/Refund.java:40"],',
    '      "suspect": "Truncating loses up to a cent per refund; it reads like a defect, not a rule."',
    "    }",
    "  ]",
    "}",
    "```",
    "",
    "Rules:",
    "- `source` names the file and line each requirement was read from, relative to the project root.",
    "- Set `suspect` (why) on behaviour you judge a defect rather than a rule: it becomes a",
    "  question for a person, not a requirement. Do not describe a bug as the contract.",
    "- Describe behaviour, not implementation: no class or method names in `text`.",
    "- Do not edit any other file.",
    "",
    "## The module's files",
    "",
  ];
  let used = 0;
  const skipped: string[] = [];
  for (const abs of files) {
    const relPath = path.relative(projectDir, abs).split(path.sep).join("/");
    let text = "";
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (used + text.length > PROMPT_BUDGET) {
      skipped.push(relPath);
      continue;
    }
    used += text.length;
    out.push(`### ${relPath}`, "", "```", text.replace(/```/g, "ˋˋˋ"), "```", "");
  }
  if (skipped.length > 0) {
    out.push(
      "## Not included — read them yourself if they matter",
      "",
      ...skipped.map((s) => `- ${s}`),
      ""
    );
  }
  return out.join("\n");
}

function proposal(id: string, mod: ReverseModule, rules: number, questions: number): string {
  return `# Proposal: ${id}

## Intent

Specify what the module \`${mod.name}\` (\`${mod.path}\`) already does, read from its
code by \`specgate reverse\`: ${rules} requirement(s), every one Draft, each citing
the lines it came from${questions > 0 ? `, and ${questions} behaviour(s) that may be defects, asked in questions.md` : ""}.

## Scope

In scope: the behaviour of \`${mod.path}\` as it runs today.

Out of scope: changing that behaviour. A requirement here moves past Draft once a
person has confirmed it is the rule, not an accident of the code.
`;
}

const TASKS = `# Tasks

## 1. Review

- [ ] 1.1 Read each requirement against the code its source= cites
- [ ] 1.2 Answer questions.md, if there is one
- [ ] 1.3 Run \`specgate change validate\`
`;

export class ReverseCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    let agentFlag = "";
    let dirArg = ".";
    let list = false;
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--agent") agentFlag = argv[++i] || "";
      else if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--modules") list = true;
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for reverse: ${a}`, {
            fix: "specgate reverse --help",
          }),
        ]);
      } else words.push(a);
    }
    if (list === words.length > 0 || words.length > 1) {
      io.usage(NULL_SHAPE, [
        error("reverse_usage", "reverse takes --modules, or one module.", {
          fix: "specgate reverse --modules",
        }),
      ]);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      io.usage(NULL_SHAPE, [
        error("project_dir_not_found", `Directory not found: ${projectDir}`, {
          fix: "specgate reverse --modules --project-dir <path>",
        }),
      ]);
    }

    const modules = reverseModules(projectDir);
    if (list) return this.list(io, projectDir, modules);
    return this.reverse(io, projectDir, modules, words[0], agentFlag, json);
  }

  /** REQ-528: the candidates, read from the tree. */
  private list(io: ReturnType<typeof agentIo>, projectDir: string, modules: ReverseModule[]) {
    if (modules.length === 0) {
      io.fail({ reverse: { modules: [] } }, [
        error(
          "no_modules",
          "No module found: no build manifests, Go packages, src/ or apps/ folders with code.",
          {
            fix: "specgate reverse <path> — name the folder to reverse yourself",
          }
        ),
      ]);
    }
    io.emit({ reverse: { modules } }, () => {
      process.stdout.write(ui.header("reverse --modules", path.basename(projectDir)));
      for (const m of modules) {
        process.stdout.write(
          `  ${m.path.padEnd(32)} ${m.stack.padEnd(8)} ${ui.muted(`${m.files} file(s)`)}\n`
        );
      }
      process.stdout.write(
        ui.next("specgate reverse <module>", "one module per run, reviewed before the next")
      );
    });
  }

  /** REQ-529, REQ-530: one module, drafted into a change. */
  private reverse(
    io: ReturnType<typeof agentIo>,
    projectDir: string,
    modules: ReverseModule[],
    wanted: string,
    agentFlag: string,
    json: boolean
  ) {
    const norm = wanted.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    let mod = modules.find((m) => m.path === norm) || modules.find((m) => m.name === norm);
    if (!mod) {
      const dir = path.resolve(projectDir, norm);
      const files = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? moduleFiles(dir) : [];
      if (files.length === 0) {
        io.usage(NULL_SHAPE, [
          error("module_not_found", `No module or folder with code named ${wanted}.`, {
            target: wanted,
            fix: "specgate reverse --modules",
          }),
        ]);
      }
      mod = { name: path.basename(dir), path: norm, stack: "unknown", files: files.length };
    }

    const changeId = reverseChangeId(mod.name);
    const p = paths(projectDir);
    const changeDir = p.change(changeId);
    if (fs.existsSync(changeDir)) {
      io.fail(NULL_SHAPE, [
        error("reverse_change_exists", `The change ${changeId} already exists.`, {
          target: changeId,
          fix: `Review or archive docs/specs/changes/${changeId} first, or delete it to reverse ${mod.name} again.`,
        }),
      ]);
    }

    let configured = "";
    try {
      configured = readHarnessConfig(projectDir)?.agent || "";
    } catch {
      configured = "";
    }
    const command = agentFlag || configured;
    if (!command) {
      io.usage(NULL_SHAPE, [
        error("reverse_needs_agent", "reverse needs an agent to read the code.", {
          fix: 'specgate reverse <module> --agent "claude -p", or specgate config set agent "<cmd>"',
        }),
      ]);
    }

    const answerRel = `docs/specs/changes/${changeId}/${REVERSE_ANSWER_FILE}`;
    const agent = withWritePermission(command);
    if (!json) {
      process.stdout.write(ui.header("reverse", mod.path));
      process.stdout.write(ui.info(`The agent is reading ${mod.files} file(s) of ${mod.path}…`));
    }
    const run = runConfinedAgent({
      projectDir,
      changeId,
      allowed: (rel) => rel === answerRel,
      command: agent.command,
      prompt: reversePrompt(
        projectDir,
        mod,
        answerRel,
        moduleFiles(path.resolve(projectDir, mod.path))
      ),
      showOutput: !json,
    });
    const discard = () => fs.rmSync(changeDir, { recursive: true, force: true });
    if (run.problem === "no_git") {
      io.fail(NULL_SHAPE, [
        error("reverse_needs_git", "reverse needs a git repository.", {
          fix: "Git is how Specgate finds what the agent wrote and undoes anything else. Run `git init`, then try again.",
        }),
      ]);
    }
    if (!run.ok) {
      discard();
      io.fail(NULL_SHAPE, [
        error("reverse_agent_failed", `The agent ${run.detail || "failed"}.`, {
          fix: "Check the agent command runs on its own, then run specgate reverse again.",
        }),
      ]);
    }
    const answerFile = path.join(projectDir, answerRel);
    if (!fs.existsSync(answerFile)) {
      discard();
      io.fail(NULL_SHAPE, [
        error("reverse_no_answer", `The agent wrote no ${answerRel}.`, {
          fix: NO_WRITE_HINT,
        }),
      ]);
    }
    const parsed = parseReverseAnswer(fs.readFileSync(answerFile, "utf8"));
    if (!parsed.ok) {
      discard();
      io.fail(
        NULL_SHAPE,
        parsed.problems.map((m) =>
          error("reverse_answer_invalid", `The agent's answer: ${m}.`, {
            fix: "Run specgate reverse again; nothing was kept.",
          })
        )
      );
      return;
    }
    const { rules, suspects } = splitSuspects(parsed.answer);
    if (rules.length === 0) {
      discard();
      io.fail(NULL_SHAPE, [
        error(
          "reverse_no_rules",
          `The agent marked every behaviour of ${mod.name} as suspect: there is no requirement to write.`,
          {
            fix: "Run specgate reverse again, or specify the module by hand with specgate propose.",
          }
        ),
      ]);
    }

    // The ids are reserved by the change.yaml that records them.
    fs.rmSync(answerFile, { force: true });
    const reqRange = reserveReqRange(projectDir, rules.length);
    const first = Number(reqRange[0].replace(/^REQ-/, ""));
    const capability = changeId.replace(/^reverse-/, "");
    const write = (rel: string, text: string) => {
      const full = path.join(changeDir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text, "utf8");
    };
    write(
      CHANGE_CONFIG_FILE,
      renderConfig({
        ...DEFAULT_CONFIG,
        created: new Date().toISOString().slice(0, 10),
        rigor: "lite",
        req_range: reqRange,
      })
    );
    write("proposal.md", proposal(changeId, mod, rules.length, suspects.length));
    write("tasks.md", TASKS);
    write(path.join("specs", capability, "spec.md"), renderReverseDelta(capability, rules, first));
    let questions: string | undefined;
    for (const s of suspects)
      questions = addQuestion(questions, changeId, suspectQuestion(s), []).md;
    if (questions) write("questions.md", questions.endsWith("\n") ? questions : `${questions}\n`);

    const validation = new ValidateChangeUseCase(new DiskProjectRepository(projectDir)).execute(
      changeId
    );
    const errors = validation.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      discard();
      io.fail(NULL_SHAPE, [
        ...validation.diagnostics,
        error(
          "reverse_change_invalid",
          `The drafted change ${changeId} does not validate; nothing was kept.`,
          {
            fix: "Run specgate reverse again.",
          }
        ),
      ]);
    }

    const ids = rules.map((_, i) => `REQ-${String(first + i).padStart(3, "0")}`);
    const changeRel = `docs/specs/changes/${changeId}`;
    io.emit(
      {
        reverse: {
          module: mod,
          change: changeId,
          path: changeRel,
          requirements: ids,
          questions: suspects.length,
          undone: run.reverted,
          next: `specgate change validate ${changeId}`,
        },
        status: validation.diagnostics,
      },
      () => {
        if (run.reverted.length > 0) {
          process.stdout.write(
            ui.warn(`Undone — the agent wrote outside its answer: ${run.reverted.join(", ")}`)
          );
        }
        process.stdout.write(
          ui.ok(`${ids.length} requirement(s) drafted into ${changeRel}, every one Draft.`) +
            (suspects.length > 0
              ? ui.info(
                  `${suspects.length} behaviour(s) that may be defects — asked in ${changeRel}/questions.md.`
                )
              : "") +
            ui.next(
              `specgate change validate ${changeId}`,
              "after you review each requirement against its source="
            )
        );
      }
    );
  }
}
