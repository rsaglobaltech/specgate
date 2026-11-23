/**
 * `harness run`: the gate — validate, the tests, the quality checks and the
 * agent checks — and the adversarial probe of a green attempt.
 */

import { sandboxCommand } from "../../../packages/core/src/domain/Sandbox";
import { quoteArg } from "../../lib/escape";
import { HarnessInterrupted, runWithDeadline } from "../../lib/run-with-deadline";
import { refreshDerivedMatrix } from "../../cli/commands/spec/MatrixCommand";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { packagesFor, reviewAdvice } from "../../lib/role-packages";
import { appendEvent } from "../../lib/harness-events";
import { e2eTestsNaming, onScreen } from "../../lib/screen-requirements";
import {
  archRun,
  gateContext,
  runStages,
  type AgentChecks,
  type CheckOutcome,
} from "../../lib/quality-run";
import { environmentFailure } from "../../lib/harness-environment";
import type { QualityCheck, Stage } from "../../../packages/core/src/domain/QualityChecks";
import { maskCommand, testCounts } from "../../../packages/core/src/domain/HarnessEvents";
import {
  resolveProfileAgent,
  HarnessSettings,
} from "../../../packages/core/src/infrastructure/HarnessConfigFile";
import type { TimeoutKind } from "../../../packages/core/src/domain/HarnessConfig";
import { PROMPT_ARCHIVE_DIR } from "../../../packages/core/src/domain/EmptyAttempt";
import { NO_PROBE, ProbeOutcome } from "../../../packages/core/src/domain/AdversarialProbe";
import {
  checkGateRun,
  invokesCucumberDirectly,
  parseCucumberMessages,
  withMessageReport,
} from "../../../packages/core/src/domain/CucumberMessages";
import {
  featureFilePath,
  substituteAgentCommand,
  substituteGateCommand,
} from "../../../packages/core/src/domain/HarnessRun";
import { removeTempFile } from "../../lib/temp-file";
import {
  judged,
  promptInFlight,
  HarnessRequirement,
  VALIDATE_SCRIPT,
  info,
  git,
  SUBPROCESS_MAX_BUFFER,
} from "./shared";

/**
 * REQ-584: the time a kind of command may take — \`timeouts:\` in
 * harness.config.yaml, in seconds — else the run's \`--timeout\`.
 */
export function limitFor(
  settings: Partial<HarnessSettings> | undefined,
  kind: TimeoutKind,
  fallbackMs: number
): number {
  const seconds = settings?.timeouts?.[kind];
  return seconds && seconds > 0 ? seconds * 1000 : fallbackMs;
}

/**
 * The resolved settings plus `verbose`, which is a run flag rather than a
 * project setting and so only ever travels with the gate's copy.
 */
export type GateSettings = Partial<HarnessSettings> & { verbose?: boolean };

/** What the gate said: green, or the stage it failed at and why. */
export interface GateResult {
  ok: boolean;
  stage: string;
  output: string;
  hint?: string;
  /** The quality checks the gate ran (ADR-0040), for the run record. */
  checks?: CheckOutcome[];
  /** A check that could not run (REQ-267): said to the person, never to the agent. */
  couldNotRun?: string;
  /** Passed with no test command to run: the specification was checked, the code was not (REQ-649). */
  unverified?: boolean;
}

/**
 * What Cucumber says it did, when it can be asked (F5).
 *
 * The gate's question has always been "did the command exit zero?", and H14
 * showed what that misses: `1 scenario (1 passed) · 0 steps · exit 0` is a
 * scenario that tested nothing and reported success. Cucumber has published a
 * machine-readable channel for years; this reads it.
 *
 * Two ways in, and neither guesses:
 *
 * - `message_report` in `harness.config.yaml` — the project writes the stream
 *   wherever it likes and says where. Works for any command.
 * - a **direct** `cucumber-js` invocation, which the harness appends
 *   `--format message:<tmp>` to. Deliberately narrow: `npm test` may well run
 *   Cucumber and there is no way to know from here, so it is left alone.
 *
 * Returns `null` when there is nothing to read — a project that does not use
 * Cucumber must not be failed by a check that never applied.
 */
export function readGateMessages(worktreeDir: string, reportPath: string) {
  if (!reportPath) return null;
  const file = path.isAbsolute(reportPath) ? reportPath : path.join(worktreeDir, reportPath);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const run = parseCucumberMessages(raw);
  return run.parsed ? run : null;
}

/** Told about each gate stage as it ends, for the event file (ADR-0037). */
export type GateReport = (
  stage: string,
  result: "start" | "pass" | "fail",
  extra?: Record<string, unknown>
) => void;

/** "0.4 s", "12 s", "3m 05s": how long a gate step took. */
export function stepTime(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs} s`;
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

/**
 * REQ-273: a gate step is an event when it starts and when it ends, and a line
 * of the run's output each time. A check that hung for 15 minutes printed
 * nothing and showed nothing in `/live` until it ended (truck-flote, S54).
 */
export function gateReporter(
  eventsFile: string,
  requirement: string,
  attempt: number | undefined,
  prefix = ""
): GateReport {
  return (stage, result, extra) => {
    const named = `${prefix}${stage}`;
    // The line names the test step, not its command: what the command prints
    // stays off a green run's output unless `--verbose` asks for it.
    const shown = named.replace(/^((?:post-merge )?test command): [\s\S]*$/, "$1");
    if (result === "start") {
      appendEvent(
        eventsFile,
        { type: "gate-start", stage: named, ...(extra || {}) },
        requirement,
        attempt
      );
      const where =
        extra && extra.image
          ? ` (${extra.runner} ${extra.image})`
          : extra && extra.runner
            ? ` (${extra.runner})`
            : "";
      info(`${requirement}: started ${shown}${where}`);
      return;
    }
    appendEvent(
      eventsFile,
      { type: "gate", stage: named, result, ...(extra || {}) },
      requirement,
      attempt
    );
    const ms = extra && typeof extra.ms === "number" ? ` in ${stepTime(extra.ms)}` : "";
    info(`${requirement}: ${result === "pass" ? "passed" : "failed"} ${shown}${ms}`);
  };
}

/** Run the gate (validate --strict, then the optional test command). */
export function runGate(
  worktreeDir: string,
  testCmd: string,
  timeoutMs: number,
  req: Partial<HarnessRequirement> = {},
  settings: GateSettings = {},
  report: GateReport = () => {}
): GateResult {
  // `--delivering`: the requirement is still Draft while its gate runs, and a
  // Draft row owes no files. Without it the gate would skip the one
  // requirement this attempt exists to deliver.
  // The agent's tests are new evidence for a generated matrix: refresh it so
  // the gate judges the attempt, not the matrix as it was before it.
  refreshDerivedMatrix(worktreeDir);
  let passHint = "";
  report("validate --strict", "start");
  const validateStart = Date.now();
  const validate = judged(worktreeDir, (dir, toProject) => {
    const validateArgs = [VALIDATE_SCRIPT, dir, "--strict"];
    if (req.requirement) validateArgs.push("--delivering", req.requirement);
    const run = spawnSync(process.execPath, validateArgs, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    // The agent is told about its worktree, not about the copy it was judged in.
    return { ...run, stdout: toProject(run.stdout || ""), stderr: toProject(run.stderr || "") };
  });
  report("validate --strict", validate.status === 0 ? "pass" : "fail", {
    ms: Date.now() - validateStart,
  });
  if (validate.status !== 0) {
    return {
      ok: false,
      stage: "validate --strict",
      output: validate.stdout + validate.stderr,
      hint: "",
    };
  }
  // REQ-199: a requirement used on a screen needs an end-to-end test that
  // names it, when the project says where those live.
  if (settings.e2eDir && req.requirement && onScreen(worktreeDir, req.requirement)) {
    report("e2e test", "start");
    const e2eStart = Date.now();
    const named = e2eTestsNaming(worktreeDir, settings.e2eDir, req.requirement);
    report("e2e test", named.length ? "pass" : "fail", { ms: Date.now() - e2eStart });
    if (named.length === 0) {
      return {
        ok: false,
        stage: "e2e test",
        output: `No file under ${settings.e2eDir} names ${req.requirement}.`,
        hint:
          `${req.requirement} is used on a screen: add an end-to-end test under ` +
          `${settings.e2eDir} that names it, driving the screen its scenarios describe.`,
      };
    }
  }
  // ADR-0028: the architecture check runs between validation and the tests,
  // and its failure goes back to the agent like any other gate failure.
  const archCmd = String(settings.archCmd || "").trim();
  if (archCmd) {
    report(`architecture check: ${maskCommand(archCmd)}`, "start");
    const archStart = Date.now();
    // REQ-231: with arch_sarif, only a violation this attempt adds fails it.
    const arch = settings.archSarif
      ? archRun(worktreeDir, archCmd, settings.archSarif, "", req.requirement || "")
      : runWithDeadline(archCmd, {
          cwd: worktreeDir,
          timeoutMs: limitFor(settings, "tests", timeoutMs),
          maxBuffer: SUBPROCESS_MAX_BUFFER,
        });
    report(`architecture check: ${maskCommand(archCmd)}`, arch.status === 0 ? "pass" : "fail", {
      ms: Date.now() - archStart,
    });
    if (arch.status !== 0) {
      return {
        ok: false,
        stage: `architecture check: ${maskCommand(archCmd)}`,
        output: (arch.stdout || "") + (arch.stderr || ""),
        hint:
          "The code is in a place the architecture does not allow. Move it to the layer the " +
          "rule names; do not change the rule.",
      };
    }
  }
  if (testCmd) {
    let resolved = substituteGateCommand(testCmd, req, quoteArg);

    // Where the message stream will be, if there is one to have.
    let reportPath = settings.messageReport || "";
    if (!reportPath && invokesCucumberDirectly(resolved)) {
      // Forward slashes on every platform: Cucumber reads `message:.harness\x`
      // on Windows as a path it does not write, and the gate then had no
      // stream to check and passed a run of no scenarios.
      reportPath = path.posix.join(
        ".harness",
        `messages-${req.requirement || "run"}-${crypto.randomBytes(3).toString("hex")}.ndjson`
      );
      fs.mkdirSync(path.join(worktreeDir, ".harness"), { recursive: true });
      resolved = withMessageReport(resolved, reportPath);
    }

    // A fresh worktree carries only what git tracks, so a project with
    // dependencies has no node_modules here. Verified the hard way: an agent
    // spent its first attempt installing them and timed out. The gate command
    // is the right place to say so, since only the project knows how.
    // `--verbose` streams instead of capturing, and streams to **fd 2**.
    //
    // `spawnSync` cannot do both: the buffers only exist once the child has
    // exited, which is the moment streaming stops being useful. Streaming is
    // the point of the flag — during a run that takes minutes there is nothing
    // to watch, and a gate that hangs looks exactly like a gate that is working.
    //
    // Stderr rather than inherited stdout, because `--format json` promises one
    // parseable document on stdout. Letting the test command write there is
    // precisely H18: prose and JSON sharing a stream.
    report(`test command: ${maskCommand(resolved)}`, "start");
    const testStart = Date.now();
    // REQ-575: the deadline ends the test command and everything it started.
    const test = runWithDeadline(resolved, {
      cwd: worktreeDir,
      timeoutMs: limitFor(settings, "tests", timeoutMs),
      maxBuffer: SUBPROCESS_MAX_BUFFER,
      toStderr: settings.verbose,
    });
    report(`test command: ${maskCommand(resolved)}`, test.status === 0 ? "pass" : "fail", {
      ...testCounts(`${test.stdout || ""}${test.stderr || ""}`),
      ms: Date.now() - testStart,
    });
    // REQ-279: a test command that could not reach Docker failed for the
    // machine, not the code; the person starts Docker, the agent cannot.
    const missing =
      test.status !== 0 ? environmentFailure(`${test.stdout || ""}${test.stderr || ""}`) : null;
    if (missing) {
      return {
        ok: false,
        stage: `test command: ${maskCommand(resolved)}`,
        output: `${test.stdout || ""}${test.stderr || ""}`,
        couldNotRun: missing,
      };
    }
    if (test.status !== 0) {
      // Name the command. A gate that silently does the wrong thing — running
      // the whole suite because a filter did not apply, say — produces a
      // failure indistinguishable from a real one, and the operator has no way
      // to tell without the command in front of them.
      // REQ-581: a test command cut at the deadline says so; its output alone reads like a failure.
      const timedOut =
        (test.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT"
          ? `The test command timed out after ${Math.round(limitFor(settings, "tests", timeoutMs) / 1000)} s and was ended, with everything it started.\n`
          : "";
      return {
        ok: false,
        stage: `test command: ${maskCommand(resolved)}${timedOut ? " (timed out)" : ""}`,
        // Streamed output is not captured, so say where it went rather than
        // recording an empty string a reader would take for "printed nothing".
        output:
          timedOut +
          (settings.verbose
            ? "(streamed above — run without --verbose to capture it in the report)"
            : `${test.stdout || ""}${test.stderr || ""}`),
      };
    }

    // Exit zero is where the old gate stopped. This is the part that catches a
    // suite that passed without covering the requirement at all.
    const messages = readGateMessages(worktreeDir, reportPath);
    if (messages) {
      const findings = checkGateRun(messages, {
        requirement: req.requirement,
        scenarioId: req.scenarioId || req.scenario_id,
        featureFile: featureFilePath(req),
      });
      const errors = findings.filter((f) => f.severity === "error");
      const warnings = findings.filter((f) => f.severity !== "error");
      if (errors.length > 0) {
        return {
          ok: false,
          stage: "cucumber messages",
          output:
            `The test command exited 0, but the run it reported does not support ` +
            `that verdict:\n\n` +
            errors.map((e) => `  ${e.message}\n  fix: ${e.fix}`).join("\n\n"),
        };
      }
      if (warnings.length > 0) passHint = warnings[0].message;
    }
  }
  // REQ-220, REQ-221: the quality checks, after the tests — the attempt ones,
  // then the end ones. A failure goes back to the agent like a failing test.
  const quality = settings.quality;
  if (quality && quality.checks.length > 0) {
    const ctx = gateContext(worktreeDir, req.requirement || "", "");
    const outcomes: CheckOutcome[] = [];
    for (const stage of ["attempt", "end"] as Stage[]) {
      // REQ-273: each check is reported as it starts and as it ends — the
      // stage used to run every check before the first was reported.
      const asItRuns = (check: QualityCheck, run: () => CheckOutcome): CheckOutcome => {
        report(`quality: ${check.name}`, "start", {
          runner: check.runner,
          ...(check.image ? { image: check.image } : {}),
        });
        const o = run();
        // REQ-229: the step says what was measured, so /live shows it as it happens.
        const said = o.skipped
          ? " (not run)"
          : o.measure && o.measure.value !== null
            ? ` ${o.measure.value}%`
            : o.findings
              ? ` · ${o.findings.freshCount} new`
              : "";
        report(`quality: ${o.name}${said}`, o.ok || !!o.skipped || !o.gate ? "pass" : "fail", {
          ms: o.ms,
          ...(o.skipped ? { skipped: o.skipped } : {}),
          ...(o.measure ? { value: o.measure.value } : {}),
        });
        return o;
      };
      for (const o of runStages(
        worktreeDir,
        quality,
        [stage],
        ctx,
        asItRuns,
        agentChecks(worktreeDir, req, settings, timeoutMs, testCmd)
      )) {
        outcomes.push(o);
        // REQ-267: a check that could not run is not the agent's to fix.
        if (o.gate && !o.ok && !o.skipped && o.couldNotRun) {
          return {
            ok: false,
            stage: `quality check: ${o.name}`,
            output: o.output,
            couldNotRun: `the quality check ${o.name} could not run: it ${o.couldNotRun}`,
            checks: outcomes,
          };
        }
        if (o.gate && !o.ok && !o.skipped) {
          return {
            ok: false,
            stage: `quality check: ${o.name}`,
            output: o.output,
            hint:
              o.measure && o.measure.kind === "coverage"
                ? "Write the tests that run the lines named above; do not lower the threshold."
                : o.measure && o.measure.kind === "mutation"
                  ? "Strengthen the tests so each surviving mutant named above would fail one."
                  : o.name === "commits"
                    ? "Reword the commits named above as Conventional Commits, or do not commit: the harness commits for you."
                    : "Fix what the check found. Do not silence it: no @SuppressWarnings, eslint-disable or baseline edit.",
            checks: outcomes,
          };
        }
      }
    }
    return {
      ok: true,
      stage: "",
      output: "",
      hint: passHint,
      checks: outcomes,
      ...(testCmd ? {} : { unverified: true }),
    };
  }
  return {
    ok: true,
    stage: "",
    output: "",
    hint: passHint,
    ...(testCmd ? {} : { unverified: true }),
  };
}

/**
 * Undo whatever an advisory agent touched.
 *
 * A reviewer returns text. If it also edited files, those edits would be gated
 * and committed as if the implementer had made them, and nobody would know
 * which agent wrote what. Discarding is cheaper to reason about than trusting
 * the reviewer to behave.
 */

export function discardWorktreeChanges(worktreeDir: string): void {
  git(worktreeDir, ["checkout", "--", "."]);
  // The prompt archive is untracked, so an unqualified `clean -fd` deletes it —
  // taking with it the record of what the reviewer and every earlier attempt
  // were given. Auditability is the reason the archive exists; discarding the
  // reviewer's edits must not discard the evidence.
  git(worktreeDir, ["clean", "-fd", "-e", PROMPT_ARCHIVE_DIR]);
}

/**
 * The worktree exactly as it is, to put back after an agent that must not
 * change it: tracked files through `git stash create` (which touches
 * nothing), untracked ones by content. An agent check runs before the commit,
 * so the implementer's work is uncommitted — `discardWorktreeChanges` would
 * throw it away (REQ-227).
 */
export function snapshotWorktree(worktreeDir: string): () => void {
  const stash = (git(worktreeDir, ["stash", "create"]).stdout || "").trim();
  const untracked = (
    git(worktreeDir, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout || ""
  )
    .split("\0")
    .filter(Boolean);
  const saved = new Map(
    untracked.map((rel) => [rel, fs.readFileSync(path.join(worktreeDir, rel))] as [string, Buffer])
  );
  return () => {
    git(worktreeDir, ["checkout", stash || "HEAD", "--", "."]);
    const now = (
      git(worktreeDir, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout || ""
    )
      .split("\0")
      .filter(Boolean);
    for (const rel of now) {
      if (!saved.has(rel) && !rel.startsWith(PROMPT_ARCHIVE_DIR)) {
        fs.rmSync(path.join(worktreeDir, rel), { force: true });
      }
    }
    for (const [rel, content] of saved) {
      fs.mkdirSync(path.dirname(path.join(worktreeDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(worktreeDir, rel), content);
    }
  };
}

/**
 * The command line an agent session runs (REQ-588): its template with the
 * prompt file put in, inside the project's container when \`sandbox:\` names
 * one — seeing the worktree, the prompt, \`mounts\`, and the variables of
 * \`agent_env:\` and \`env\` only.
 */
export function agentLine(
  template: string,
  promptFile: string,
  worktreeDir: string,
  settings: Partial<HarnessSettings> | undefined,
  extra: { env?: string[]; mounts?: string[] } = {}
): string {
  const line = substituteAgentCommand(template, promptFile);
  if (!settings?.sandbox) return line;
  return sandboxCommand(line, settings.sandbox, {
    worktree: worktreeDir,
    mounts: [promptFile, ...(extra.mounts || [])],
    env: [...(settings.agentEnv || []), ...(extra.env || [])],
    user:
      typeof process.getuid === "function" && typeof process.getgid === "function"
        ? `${process.getuid()}:${process.getgid()}`
        : null,
  });
}

/** Run an agent on an instruction built into the requirement's prompt; its output. */
export function runAgentOnce(
  worktreeDir: string,
  command: string,
  prompt: string,
  timeoutMs: number,
  tag: string,
  /** REQ-587, REQ-588: \`agent_env:\` and \`sandbox:\`, when the project sets them. */
  settings?: Partial<HarnessSettings>
): string {
  const agentEnv = settings?.agentEnv;
  const promptFile = path.join(
    os.tmpdir(),
    `specgate-${tag}-${crypto.randomBytes(4).toString("hex")}.md`
  );
  try {
    fs.writeFileSync(promptFile, prompt, { encoding: "utf8", mode: 0o600 });
    const r = runWithDeadline(agentLine(command, promptFile, worktreeDir, settings), {
      cwd: worktreeDir,
      ...(agentEnv ? { envAllow: agentEnv } : {}),
      timeoutMs,
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });
    return `${r.stdout || ""}${r.stderr || ""}`.trim();
  } finally {
    removeTempFile(promptFile);
  }
}

/**
 * The project a worktree belongs to (REQ-577): the folder of its repository's
 * common git directory — the working copy the person runs the harness from,
 * which no agent writes into.
 */
export function projectOf(worktreeDir: string): string {
  const common = git(worktreeDir, ["rev-parse", "--git-common-dir"]);
  const dir = String(common.stdout || "").trim();
  return common.status === 0 && dir ? path.dirname(path.resolve(worktreeDir, dir)) : worktreeDir;
}

/**
 * The agent checks of REQ-227, lent to the quality stages of a harness gate:
 * `builtin:review` — a second agent reads the change against the requirement
 * and answers VERDICT: PASS or FAIL; `builtin:adversary` — one writes a test
 * that tries to break it, which is run and then removed. Neither may change
 * the work: the worktree is put back exactly as it was.
 */

export function agentChecks(
  worktreeDir: string,
  req: Partial<HarnessRequirement>,
  settings: GateSettings,
  timeoutMs: number,
  testCmd: string
): AgentChecks {
  const commandFor = (check: QualityCheck, fallback: string) => {
    const profile = check.profile || fallback;
    if (!profile) return settings.agent || "";
    const known = (settings.profileAgents || {})[profile];
    if (known) return known;
    try {
      // A profile only a check names is not resolved with the others. REQ-577:
      // from the project, never the worktree — the agent writes there, and
      // would choose the command that reviews its own work.
      return resolveProfileAgent(projectOf(worktreeDir), profile);
    } catch {
      return settings.agent || "";
    }
  };
  const promptFor = (instruction: string) =>
    promptInFlight(req as HarnessRequirement, worktreeDir, {
      promptPrefix: settings.promptPrefix,
      hint: instruction,
      withPrecedents: settings.promptPrecedents === true,
    });
  return {
    "builtin:review": (check) => {
      const command = commandFor(check, settings.reviewProfile || "");
      if (!command) return { ok: true, output: "no agent configured to review" };
      const diff = (git(worktreeDir, ["diff", "HEAD"]).stdout || "").slice(0, 60000);
      const restore = snapshotWorktree(worktreeDir);
      let said = "";
      try {
        said = runAgentOnce(
          worktreeDir,
          command,
          promptFor(
            `Review only; change no file. Compare the change below with ${req.requirement}, its ` +
              "statement and every scenario. Answer with a first line `VERDICT: PASS` when the " +
              "change does what the requirement says and nothing it forbids, or `VERDICT: FAIL` " +
              "followed by each reason as `- path:line — what is wrong`." +
              // REQ-318: one advice line per role package; it never decides the verdict.
              reviewAdvice(
                judged(worktreeDir, (d) => packagesFor(d, String(req.requirement || "")))
              ) +
              "\n\n```diff\n" +
              diff +
              "\n```"
          ),
          limitFor(settings, "review", timeoutMs),
          "review",
          settings
        );
      } finally {
        restore();
      }
      const verdict = /VERDICT:\s*(PASS|FAIL)/i.exec(said);
      // REQ-581: no verdict is not a pass — a reviewer that crashed, timed out
      // or answered something else has not approved anything.
      if (!verdict) {
        return {
          ok: false,
          output: `The reviewer gave no verdict:
${said.slice(0, 2000)}`,
        };
      }
      return { ok: verdict[1].toUpperCase() === "PASS", output: said.slice(0, 4000) };
    },
    "builtin:adversary": (check) => {
      const command = commandFor(check, settings.adversaryProfile || "");
      if (!command || !testCmd)
        return { ok: true, output: "no agent or test command to probe with" };
      const restore = snapshotWorktree(worktreeDir);
      try {
        const before = new Set(
          (git(worktreeDir, ["status", "--porcelain"]).stdout || "").split("\n").filter(Boolean)
        );
        const said = runAgentOnce(
          worktreeDir,
          command,
          promptFor(
            `Try to **break** the implementation of ${req.requirement}: write one additional ` +
              "test, in the project's test style, for a case it should handle and might not — an " +
              "empty input, a boundary, a duplicate, a failure path. Write the test and nothing " +
              "else; do not modify the implementation, the specification or any existing test."
          ),
          limitFor(settings, "review", timeoutMs),
          "adversary",
          settings
        );
        const wrote = (git(worktreeDir, ["status", "--porcelain"]).stdout || "")
          .split("\n")
          .filter((l) => l && !before.has(l) && !l.slice(3).startsWith(PROMPT_ARCHIVE_DIR));
        if (wrote.length === 0) return { ok: true, output: "The adversary wrote no test." };
        const test = runWithDeadline(substituteGateCommand(testCmd, req, quoteArg), {
          cwd: worktreeDir,
          timeoutMs: limitFor(settings, "tests", timeoutMs),
          maxBuffer: SUBPROCESS_MAX_BUFFER,
        });
        return {
          ok: test.status === 0,
          output: [
            `The adversary wrote ${wrote.map((l) => l.slice(3)).join(", ")}; the tests ${test.status === 0 ? "still pass" : "fail"}.`,
            said.slice(0, 1500),
            test.status === 0 ? "" : `${test.stdout || ""}${test.stderr || ""}`.slice(-3000),
          ]
            .filter(Boolean)
            .join("\n\n"),
        };
      } finally {
        restore();
      }
    },
  };
}

/**
 * Let an adversary try to break a green implementation (D3).
 *
 * Sequence, and the order is the whole design: the gate has already passed, so
 * the work is committable; the adversary writes a test in the worktree; the
 * project's own test command runs again; whatever the adversary wrote is
 * discarded so the branch carries the implementer's work alone.
 *
 * Never throws and never changes the verdict. The gate stays the only judge —
 * an adversary can always assert a behaviour the requirement never promised,
 * and a failing probe that blocked the run would stop correct work.
 */
export function runAdversarialProbe(
  worktreeDir: string,
  req: HarnessRequirement,
  settings: HarnessSettings,
  timeoutMs: number,
  promptFor: (instruction: string) => string
): ProbeOutcome {
  const profile = settings.adversaryProfile;
  const command = settings.profileAgents[profile] || settings.agent;
  if (!command) return NO_PROBE;

  const instruction =
    `The implementation below already passes its gate. Your job is to try to ` +
    `**break** it: write one additional test, in the project's existing test ` +
    `style, for a case ${req.requirement} should handle and might not — an ` +
    `empty input, a boundary, a duplicate, a failure path. Write the test and ` +
    `nothing else. Do not modify the implementation, the specification or any ` +
    `existing test.`;

  const promptFile = path.join(
    os.tmpdir(),
    `specgate-probe-${req.requirement}-${crypto.randomBytes(4).toString("hex")}.md`
  );

  try {
    fs.writeFileSync(promptFile, promptFor(instruction), { encoding: "utf8", mode: 0o600 });
    const agent = runWithDeadline(agentLine(command, promptFile, worktreeDir, settings), {
      cwd: worktreeDir,
      ...(settings.agentEnv ? { envAllow: settings.agentEnv } : {}),
      timeoutMs: limitFor(settings, "review", timeoutMs),
      maxBuffer: SUBPROCESS_MAX_BUFFER,
    });

    const wrote = git(worktreeDir, ["status", "--porcelain"])
      .stdout.split("\n")
      .map((line) => line.slice(3).trim())
      .filter((line) => line && !line.startsWith(PROMPT_ARCHIVE_DIR));

    if (wrote.length === 0) {
      // Nothing written is not a failure: an adversary that cannot think of a
      // case is telling you something mildly reassuring.
      return { ran: true, broke: false, detail: "The adversary wrote no test.", wrote: [] };
    }

    const after = runGate(worktreeDir, settings.testCmd, timeoutMs, req, {
      ...settings,
      quality: undefined,
    });
    return {
      ran: true,
      broke: !after.ok,
      detail: [`${agent.stdout || ""}${agent.stderr || ""}`.trim(), after.output || ""]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000),
      wrote,
    };
  } catch (e) {
    // REQ-573: an interrupted run stops here too.
    if (e instanceof HarnessInterrupted) throw e;
    // Insurance that fails is still only insurance; it must not take the run.
    return NO_PROBE;
  } finally {
    try {
      removeTempFile(promptFile);
    } catch {
      /* a temp file nobody will read again */
    }
    // The branch carries the implementer's work and nothing else.
    discardWorktreeChanges(worktreeDir);
  }
}
