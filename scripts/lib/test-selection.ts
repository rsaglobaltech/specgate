/**
 * Which tests the gate runs, and the command that runs them (REQ-510 … REQ-516).
 *
 * `check` with no flag runs the whole suite, as it always did; `--ci` always
 * does. `--affected` runs what the change touches — through `{files}` or
 * `{req}` in the test command — and, with `{files}`, not again a test file
 * that passed on the same code. Every answer says which it was and why, as
 * `selection`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type FullCause, fillTestCommand } from "../../packages/core/src/domain/AffectedTests";
import { gateTestCommand } from "../../packages/core/src/domain/DoneVerification";
import type { HarnessSettings } from "../../packages/core/src/domain/HarnessConfig";
import { type Diagnostic, info } from "./diagnostics";
import { quoteArg } from "./escape";
import { planAffected, projectFiles } from "./affected";
import { ImportGraph } from "./import-graph";
import { TestCache } from "./test-cache";
import { matrixScenarios } from "../cli/commands/spec/MatrixCommand";

/** `selection` in every `check --json` answer, and in the last result kept. */
export interface TestSelection {
  mode: "affected" | "full";
  /** Why these tests: what changed, or why the whole suite runs. */
  reason: string;
  /** The ref the change was compared with; null when none was. */
  base: string | null;
  /** The files that changed since it. */
  changed: string[];
  /** The requirements the change touches. */
  requirements: string[];
  /** The test files selected; empty when the whole suite runs. */
  tests: string[];
  /** Selected test files not run again: they passed before on the same code. */
  cached: string[];
  /** The command that ran; null when none did. */
  command: string | null;
}

export interface TestPlan {
  selection: TestSelection;
  /** What to run; null when no test command is configured, or every test is cached. */
  command: string | null;
  findings: Diagnostic[];
  /** Keep the outcome for the cache; a no-op when it is not in use. */
  done: (passed: boolean) => void;
}

const FIX: Record<FullCause, string> = {
  "nothing-changed":
    "Nothing to do: with no change, the whole suite is the only honest answer. `specgate check --affected --base <ref>` compares with another base.",
  "no-base": "specgate check --affected --base <branch>",
  global:
    "Nothing to do: a change to that file can change any test's result. `full_on:` in harness.config.yaml adds your own such files.",
  removed:
    "Nothing to do: name the requirement in the code that replaces it, and the next check --affected maps it.",
  unlinked:
    "Name the requirement the file serves in it (a comment is enough), import it from the test that proves it, or list it under `full_on:` in harness.config.yaml.",
  "no-tests":
    "Name the requirement in the test that proves it — the matrix links it then — and check --affected runs that test.",
  "no-files":
    'Add {files} where your runner takes test files: specgate config set test_cmd_affected "<your test command> {files}".',
  "too-long": "Narrow the change, or run `specgate check` for the whole suite.",
};

/** The tests `check` runs, and how. */
export function planTests(
  projectDir: string,
  opts: {
    affected: boolean;
    ci: boolean;
    noCache: boolean;
    base?: string;
    /** `--test-cmd`, which wins over both settings. */
    testCmd?: string;
    harness: Partial<HarnessSettings>;
  }
): TestPlan {
  const whole = (opts.testCmd ?? opts.harness.testCmd ?? "").trim();
  const wholeCommand = gateTestCommand(whole) || null;
  const nothing = () => undefined;
  const fullSelection = (reason: string, extra: Partial<TestSelection> = {}): TestSelection => ({
    mode: "full",
    reason,
    base: null,
    changed: [],
    requirements: [],
    tests: [],
    cached: [],
    command: wholeCommand,
    ...extra,
  });

  if (!wholeCommand) {
    return {
      selection: fullSelection("no test command is configured", { command: null }),
      command: null,
      findings: [],
      done: nothing,
    };
  }
  if (opts.ci) {
    return {
      selection: fullSelection("--ci runs the whole suite"),
      command: wholeCommand,
      findings: opts.affected
        ? [
            info("affected_ignored_ci", "--ci runs the whole suite: --affected is ignored there.", {
              fix: "specgate check --affected, on your machine, runs only what the change touches.",
            }),
          ]
        : [],
      done: nothing,
    };
  }
  if (!opts.affected) {
    return {
      selection: fullSelection(
        "the whole suite, as always: `specgate check --affected` runs only what the change touches"
      ),
      command: wholeCommand,
      findings: [],
      done: nothing,
    };
  }

  const fullOn = opts.harness.fullOn || [];
  const plan = planAffected(projectDir, { base: opts.base, fullOn });
  const template = (opts.testCmd ?? (opts.harness.testCmdAffected || whole)).trim();
  const facts = { base: plan.base, changed: plan.changed, requirements: plan.requirements };
  const affectedFull = (cause: FullCause, reason: string): TestPlan => ({
    selection: fullSelection(reason, facts),
    command: wholeCommand,
    findings: [
      info("affected_full", `check --affected runs the whole suite: ${reason}.`, {
        fix: FIX[cause],
      }),
    ],
    done: nothing,
  });
  if (plan.mode === "full") return affectedFull(plan.cause || "no-tests", plan.reason);

  const quote = (f: string) => quoteArg(f);
  const filled = fillTestCommand(template, plan, quote, process.platform);
  if (filled.fullBecause) {
    const out = affectedFull(filled.cause || "no-files", filled.fullBecause);
    if (filled.finding) {
      out.findings = [
        info(
          filled.finding,
          `The test command runs the whole suite: ${filled.fullBecause}, so check --affected cannot hand it the ${plan.tests.length} selected test file(s).`,
          { fix: FIX["no-files"] }
        ),
      ];
    }
    out.selection.tests = plan.tests;
    return out;
  }

  // REQ-516: with {files}, a test that passed on the same code is not run again.
  let cache: TestCache | null = null;
  let toRun = plan.tests;
  let cached: string[] = [];
  if (template.includes("{files}") && !opts.noCache) {
    const files = plan.files || projectFiles(projectDir);
    if (files) {
      const graph = plan.graph || new ImportGraph(projectDir, files);
      cache = new TestCache(projectDir, template, files, graph, plan.rows, fullOn);
      cached = cache.cached(plan.tests);
      toRun = plan.tests.filter((t) => !cached.includes(t));
    }
  }
  const findings: Diagnostic[] = [];
  if (cached.length > 0) {
    findings.push(
      info(
        "tests_cached",
        `${cached.length} selected test file(s) passed before on the same code and were not run again: ${cached.join(", ")}.`,
        { fix: "specgate check --affected --no-cache runs them again." }
      )
    );
  }
  const command =
    toRun.length === 0
      ? null
      : fillTestCommand(template, { ...plan, tests: toRun }, quote, process.platform).command;
  const snapshot = cache && toRun.length > 0 ? cache.snapshot(toRun) : null;
  return {
    selection: {
      mode: "affected",
      reason: plan.reason,
      ...facts,
      tests: plan.tests,
      cached,
      command,
    },
    command,
    findings,
    done: (passed) => {
      if (cache && snapshot) cache.record(snapshot, passed);
    },
  };
}

/**
 * The test files the matrix links to these requirements, open changes
 * included, quoted for the shell and joined for `{files}` (REQ-515). Empty
 * when none exists: `{files}` empty runs the whole suite.
 */
export function requirementTestFiles(projectDir: string, ids: readonly string[]): string {
  const wanted = new Set(ids);
  const tests = new Set<string>();
  for (const row of matrixScenarios(projectDir)) {
    if (!wanted.has(row.requirement)) continue;
    for (const t of row.tests) {
      if (fs.existsSync(path.join(projectDir, ...t.split("/")))) tests.add(t);
    }
  }
  return [...tests]
    .sort()
    .map((t) => quoteArg(t))
    .join(" ");
}

/** The command `apply` runs as the tests: `--test-cmd`, else `test_cmd_affected`, else `test_cmd`. */
export function applyTestCommand(
  flag: string | undefined,
  harness: Partial<HarnessSettings>
): string | undefined {
  return flag || harness.testCmdAffected || harness.testCmd;
}
