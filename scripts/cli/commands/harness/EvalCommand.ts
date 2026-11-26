import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import type { AgentIo } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import { forShell } from "../../../lib/shell-command";
import { parseYamlLite } from "../../../../packages/core/src/domain/YamlLite";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import {
  compareWith,
  examScore,
  goodOf,
  trend,
  taskScore,
  type HistoryEntry,
  type RunResult,
} from "../../../../packages/core/src/domain/SkillEval";

const NULL_SHAPE = { eval: null };
/** This checkout's CLI: each run's gate is `specgate check` in its copy. */
const CLI = path.resolve(__dirname, "..", "..", "..", "..", "..", "bin", "specgate.js");

function usage(): void {
  process.stdout.write(
    `
  🧪 ${c.bold}specgate eval${c.reset} <skill> [--runs <n>] [--agent <cmd>] [--json] [--project-dir <dir>]
     ${c.bold}specgate eval${c.reset} --list [--json]   every exam, its texts, history, progress and last runs

  Examine a skill (trust curve, phase 5): each task of evals/<skill>/eval.yaml
  run several times in parallel, each on a clean copy of its fixture with the
  skill handed to the agent. Correct: specgate check passes. Good: the
  architecture and quality stages, and the reviewer's score. Each exam is kept
  in evals/<skill>/history.jsonl per version of the skill, and compared.

    skill: .claude/skills/<skill>/SKILL.md
    agent: "claude -p < {prompt_file}"     # default: the harness's agent
    runs: 3
    reviewer: "node review.js {dir}"        # optional, prints 0–10
    tasks:
      - id: cancel
        fixture: tasks/cancel               # a project folder under the exam
        prompt: "Implement REQ-031 …"
        check: "node --test hidden/"        # optional: run after the agent, unseen
        check_files: [hidden/cancel.test.js] # copied in only for the check
`
  );
}

interface Task {
  id: string;
  fixture: string;
  prompt: string;
  /** lab-fixes REQ-697: run after the agent, which never sees it. */
  check?: string;
  /** Files of the exam copied into the copy only for `check`. */
  check_files?: string[] | string;
}

function sh(
  command: string,
  cwd: string,
  onChunk?: (text: string) => void
): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(forShell(command), {
      cwd,
      shell: true,
      env: { ...process.env, SPECGATE_EVAL: "1" },
    });
    let out = "";
    const take = (d: Buffer) => {
      out += d;
      onChunk?.(String(d));
    };
    p.stdout.on("data", take);
    p.stderr.on("data", take);
    p.on("close", (code) => resolve({ code: code ?? 1, out }));
    p.on("error", () => resolve({ code: 1, out }));
  });
}

function node(args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd, env: { ...process.env, NO_COLOR: "1" } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code: code ?? 1, out }));
    p.on("error", () => resolve({ code: 1, out }));
  });
}

/** One run: a clean copy, the agent with the skill and the task, then the gate. */
async function oneRun(
  examDir: string,
  task: Task,
  skill: string,
  agent: string,
  reviewer: string | null,
  /** REQ-704: where this run keeps its prompt and its log, as it happens. */
  runDir: string
): Promise<RunResult & { dir: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `specgate-eval-${task.id}-`));
  fs.mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, "log.jsonl");
  const log = (event: Record<string, unknown>) =>
    fs.appendFileSync(logFile, `${JSON.stringify({ t: Date.now() / 1000, ...event })}\n`, "utf8");
  try {
    fs.cpSync(path.join(examDir, task.fixture), dir, { recursive: true });
    const git = (...a: string[]) =>
      spawnSync("git", ["-c", "user.email=eval@specgate", "-c", "user.name=specgate eval", ...a], {
        cwd: dir,
      });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "the task as given", "--allow-empty");
    const promptFile = `${dir}.prompt.md`;
    const prompt = `${skill.trimEnd()}\n\n---\n\n${task.prompt}\n`;
    fs.writeFileSync(promptFile, prompt, "utf8");
    fs.writeFileSync(path.join(runDir, "prompt.md"), prompt, "utf8");
    log({ type: "start", task: task.id });
    const agentRun = await sh(agent.split("{prompt_file}").join(promptFile), dir, (text) =>
      log({ type: "output", text })
    );
    log({ type: "agent-end", exit: agentRun.code });
    fs.rmSync(promptFile, { force: true });
    const check = await node([CLI, "check", dir, "--json"], dir);
    log({ type: "check", exit: check.code, summary: checkSummary(check.out) });
    // lab-fixes REQ-697: the hidden check, its files brought in only now.
    let hidden = true;
    if (task.check) {
      const files = Array.isArray(task.check_files)
        ? task.check_files
        : task.check_files
          ? [task.check_files]
          : [];
      for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.cpSync(path.join(examDir, f), path.join(dir, f), { recursive: true });
      }
      const h = await sh(task.check, dir);
      hidden = h.code === 0;
      log({ type: "hidden", exit: h.code, output: h.out.slice(-4000) });
    }
    let stages: number[] = [];
    try {
      const doc = JSON.parse(check.out) as { stages?: Array<{ stage: string; result: string }> };
      stages = (doc.stages || [])
        .filter(
          (s) => (s.stage === "architecture" || s.stage === "quality") && s.result !== "skipped"
        )
        .map((s) => (s.result === "passed" ? 1 : 0));
    } catch {
      /* no answer: no stage measured */
    }
    let review: number | null = null;
    if (reviewer) {
      const r = await sh(reviewer.split("{dir}").join(dir), dir);
      const m = r.out.match(/-?\d+(?:\.\d+)?/);
      if (m) review = Math.max(0, Math.min(10, Number(m[0]))) / 10;
    }
    const result = { correct: check.code === 0 && hidden, stages, reviewer: review, dir };
    log({ type: "end", correct: result.correct, good: goodOf(result) });
    return result;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** `specgate check --json`'s verdict in one line: each stage and its result. */
function checkSummary(out: string): string {
  try {
    const doc = JSON.parse(out) as { stages?: Array<{ stage: string; result: string }> };
    return (doc.stages || []).map((x) => `${x.stage} ${x.result}`).join(" · ");
  } catch {
    return out.trim().split("\n").slice(-1)[0] || "";
  }
}

/** REQ-704: only the last exams' folders are kept. */
const KEEP_EXAMS = 5;

async function pool<T>(jobs: Array<() => Promise<T>>, size: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, jobs.length)) }, worker));
  return out;
}

export class EvalCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let runsArg: number | null = null;
    let agentArg: string | null = null;
    let listing = false;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--runs") runsArg = Number(argv[++i]) || null;
      else if (a === "--agent") agentArg = argv[++i] || null;
      else if (a === "--json") continue;
      else if (a === "--list") listing = true;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for eval: ${a}`, { fix: "specgate eval --help" }),
        ]);
    }
    if (listing) return this.list(path.resolve(dirArg), io);
    void this.run(path.resolve(dirArg), positional[0], runsArg, agentArg, io);
  }

  /** REQ-702, REQ-703, REQ-704: every exam, its texts, history, progress and last runs. */
  private list(dir: string, io: AgentIo) {
    const root = path.join(dir, "evals");
    let names: string[] = [];
    try {
      names = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, "eval.yaml")))
        .map((e) => e.name)
        .sort();
    } catch {
      names = [];
    }
    const rel = (f: string) => path.relative(dir, f).split(path.sep).join("/");
    const read = (f: string) => {
      try {
        return fs.readFileSync(f, "utf8");
      } catch {
        return null;
      }
    };
    const exams = names.map((name) => {
      const examDir = path.join(root, name);
      const examText = read(path.join(examDir, "eval.yaml")) || "";
      const doc = (parseYamlLite(examText) || {}) as Record<string, unknown>;
      const skillFile = String(doc.skill || "");
      const skillText = skillFile ? read(path.join(dir, skillFile)) : null;
      const version = skillText
        ? crypto.createHash("sha256").update(skillText).digest("hex").slice(0, 12)
        : null;
      const tasks = ((Array.isArray(doc.tasks) ? doc.tasks : []) as Task[]).map((t) => ({
        id: String(t.id || ""),
        prompt: String(t.prompt || ""),
        check: t.check ? String(t.check) : null,
        hidden: Boolean(t.check),
      }));
      const history = (read(path.join(examDir, "history.jsonl")) || "")
        .split("\n")
        .filter((l) => l.trim())
        .flatMap((l) => {
          try {
            return [JSON.parse(l) as HistoryEntry];
          } catch {
            return [];
          }
        });
      // Per version, its last exam, against the version before it.
      const versions: Array<{
        version: string;
        at: string;
        correct: number;
        good: number | null;
        vsPrevious: { correct: string | null; good: string | null } | null;
      }> = [];
      for (const h of history) {
        const at = versions.findIndex((v) => v.version === h.version);
        const row = {
          version: h.version,
          at: h.at,
          correct: h.correct,
          good: h.good,
          vsPrevious: null,
        };
        if (at >= 0) versions.splice(at, 1);
        versions.push(row);
      }
      for (let i = 1; i < versions.length; i += 1) {
        const before = versions[i - 1];
        const now = versions[i];
        now.vsPrevious = {
          correct: trend(now.correct, before.correct),
          good: trend(now.good, before.good),
        };
      }
      const runningText = read(path.join(examDir, "running.json"));
      let running: unknown = null;
      try {
        running = runningText ? JSON.parse(runningText) : null;
      } catch {
        running = null;
      }
      // The last exam's runs: the one running, else the newest folder.
      const runsDir = path.join(examDir, "runs");
      let stamps: string[] = [];
      try {
        stamps = fs.readdirSync(runsDir).sort();
      } catch {
        stamps = [];
      }
      const lastStamp =
        (running as { stamp?: string } | null)?.stamp || stamps[stamps.length - 1] || null;
      const lastRuns = lastStamp
        ? (() => {
            let folders: string[] = [];
            try {
              folders = fs.readdirSync(path.join(runsDir, lastStamp)).sort();
            } catch {
              folders = [];
            }
            return folders.map((f) => {
              const folder = path.join(runsDir, lastStamp, f);
              const events = (read(path.join(folder, "log.jsonl")) || "")
                .split("\n")
                .filter((l) => l.trim())
                .flatMap((l) => {
                  try {
                    return [JSON.parse(l) as Record<string, unknown>];
                  } catch {
                    return [];
                  }
                });
              const end = events.find((e) => e.type === "end");
              const hiddenEv = events.find((e) => e.type === "hidden");
              return {
                id: f,
                task: f.replace(/-\d+$/, ""),
                folder: rel(folder),
                state: end ? "ended" : "running",
                correct: end ? Boolean(end.correct) : null,
                good: end && typeof end.good === "number" ? end.good : null,
                hiddenExit: hiddenEv && typeof hiddenEv.exit === "number" ? hiddenEv.exit : null,
              };
            });
          })()
        : [];
      return {
        skill: name,
        file: rel(path.join(examDir, "eval.yaml")),
        examText,
        skillFile,
        skillText,
        version,
        agent: typeof doc.agent === "string" ? doc.agent : null,
        runs: Number(doc.runs) || 3,
        tasks,
        history: history.map((h) => ({
          at: h.at,
          version: h.version,
          runs: h.runs,
          correct: h.correct,
          good: h.good,
        })),
        versions,
        running,
        lastExam: lastStamp,
        lastRuns,
      };
    });
    io.emit({ evals: { exams } }, () => {
      const out = (x: string) => process.stdout.write(x);
      out(ui.header("eval --list", `${exams.length} exam(s)`));
      const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
      for (const e of exams) {
        const last = e.versions[e.versions.length - 1];
        out(
          `  ${c.bold}${e.skill}${c.reset}  ${ui.muted(`${e.tasks.length} task(s) · version ${e.version ?? "—"}`)}\n`
        );
        if (last)
          out(
            `     last: correct ${pct(last.correct)} · good ${pct(last.good)}${last.vsPrevious ? ` · ${last.vsPrevious.correct} than before` : ""}\n`
          );
        const r = e.running as { runs?: number; ended?: number; correct?: number } | null;
        if (r) out(`     running: ${r.ended}/${r.runs} ended · ${r.correct} correct\n`);
      }
      out("\n");
    });
  }

  private async run(
    dir: string,
    skillName: string,
    runsArg: number | null,
    agentArg: string | null,
    io: AgentIo
  ) {
    const examDir = path.join(dir, "evals", skillName);
    const file = path.join(examDir, "eval.yaml");
    const rel = path.relative(dir, file).split(path.sep).join("/");
    if (!fs.existsSync(file)) {
      io.fail(NULL_SHAPE, [
        error("eval_not_found", `No exam for the skill ${skillName}.`, {
          fix: `Write ${rel}: the skill, the agent, runs and the tasks — specgate eval --help shows one.`,
        }),
      ]);
      return;
    }
    const doc = (parseYamlLite(fs.readFileSync(file, "utf8")) || {}) as Record<string, unknown>;
    const skillPath = path.join(dir, String(doc.skill || ""));
    const tasks = (Array.isArray(doc.tasks) ? doc.tasks : []) as Task[];
    const agent =
      agentArg ||
      (typeof doc.agent === "string" ? doc.agent : "") ||
      readHarnessConfig(dir)?.agent ||
      "";
    const problems: string[] = [];
    if (!doc.skill || !fs.existsSync(skillPath))
      problems.push(`its skill file (${String(doc.skill || "skill:")}) does not exist`);
    if (!agent.includes("{prompt_file}")) problems.push("no agent with {prompt_file}");
    if (!tasks.length) problems.push("it has no tasks");
    for (const t of tasks)
      if (!t?.id || !t.prompt || !t.fixture || !fs.existsSync(path.join(examDir, t.fixture)))
        problems.push(
          `task ${t?.id ?? "?"} needs an id, a prompt and a fixture folder that exists`
        );
    for (const t of tasks) {
      const files = Array.isArray(t?.check_files)
        ? t.check_files
        : t?.check_files
          ? [t.check_files]
          : [];
      for (const f of files)
        if (!fs.existsSync(path.join(examDir, f)))
          problems.push(`task ${t.id}: its check file ${f} does not exist`);
    }
    if (problems.length) {
      io.fail(NULL_SHAPE, [
        error("eval_invalid", `${rel} cannot run: ${problems.join("; ")}.`, {
          file: rel,
          fix: "specgate eval --help",
        }),
      ]);
      return;
    }
    const skill = fs.readFileSync(skillPath, "utf8");
    const version = crypto.createHash("sha256").update(skill).digest("hex").slice(0, 12);
    const runs = runsArg || Number(doc.runs) || 3;
    const concurrency = Number(doc.concurrency) || runs;
    const reviewer = typeof doc.reviewer === "string" && doc.reviewer.trim() ? doc.reviewer : null;

    // REQ-704: this exam's folder, its runs' prompts and logs in it; git leaves them out.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runsDir = path.join(examDir, "runs");
    const ignore = path.join(examDir, ".gitignore");
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "runs/\nrunning.json\n", "utf8");
    // REQ-703: how far the exam got, while it runs.
    const runningFile = path.join(examDir, "running.json");
    const progress = {
      started: new Date().toISOString(),
      stamp,
      runs: tasks.length * runs,
      ended: 0,
      correct: 0,
    };
    const writeProgress = () =>
      fs.writeFileSync(runningFile, `${JSON.stringify(progress)}\n`, "utf8");
    writeProgress();
    const jobs = tasks.flatMap((t) =>
      Array.from(
        { length: runs },
        (_, n) => () =>
          oneRun(
            examDir,
            t,
            skill,
            agent,
            reviewer,
            path.join(runsDir, stamp, `${t.id}-${n + 1}`)
          ).then((r) => {
            progress.ended += 1;
            if (r.correct) progress.correct += 1;
            writeProgress();
            return { task: t.id, r };
          })
      )
    );
    let done: Array<{ task: string; r: RunResult & { dir: string } }>;
    try {
      done = await pool(jobs, concurrency);
    } finally {
      fs.rmSync(runningFile, { force: true });
    }
    try {
      const exams = fs.readdirSync(runsDir).sort();
      for (const old of exams.slice(0, Math.max(0, exams.length - KEEP_EXAMS)))
        fs.rmSync(path.join(runsDir, old), { recursive: true, force: true });
    } catch {
      /* no runs folder */
    }
    const byTask = tasks.map((t) => ({
      id: t.id,
      runs: done.filter((d) => d.task === t.id).map((d) => d.r),
    }));
    const score = examScore(byTask);
    const tasksOut = byTask.map((t) => ({ ...taskScore(t.id, t.runs), results: t.runs }));

    const historyFile = path.join(examDir, "history.jsonl");
    const history: HistoryEntry[] = fs.existsSync(historyFile)
      ? fs
          .readFileSync(historyFile, "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .flatMap((l) => {
            try {
              return [JSON.parse(l)];
            } catch {
              return [];
            }
          })
      : [];
    const compared = compareWith(history, version, score);
    const entry: HistoryEntry = {
      at: new Date().toISOString(),
      version,
      runs,
      correct: score.correct,
      good: score.good,
      tasks: tasksOut.map(({ results: _r, ...t }) => t),
    };
    fs.appendFileSync(historyFile, `${JSON.stringify(entry)}\n`, "utf8");

    const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
    io.emit(
      {
        eval: {
          skill: skillName,
          version,
          runs,
          correct: score.correct,
          good: score.good,
          tasks: tasksOut,
          compared,
        },
      },
      () => {
        const out = (s: string) => process.stdout.write(s);
        out(ui.header("eval", `${skillName} · version ${version}`));
        for (const t of tasksOut)
          out(
            `  ${c.bold}${t.id.padEnd(20)}${c.reset}${String(t.correct)}/${t.runs} correct  ${ui.muted(`good ${pct(t.good)}`)}\n`
          );
        out(
          `\n  ${c.bold}correct ${pct(score.correct)}${c.reset}  ${ui.muted(`good ${pct(score.good)}`)}\n`
        );
        if (compared)
          out(
            `  ${ui.muted(`against ${compared.version}: correct ${compared.correct} (${pct(compared.from)} → ${pct(score.correct)}), good ${compared.good ?? "—"}`)}\n`
          );
        out(
          `\n  ${ui.muted(`kept in ${path.relative(dir, historyFile).split(path.sep).join("/")}`)}\n\n`
        );
      }
    );
  }
}
