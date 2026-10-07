#!/usr/bin/env node
/**
 * `harness init` — scaffold `harness.config.yaml` and `.harness/prompt-prefix.md`.
 *
 * The config was documented in the tutorial and named in `harness run`'s own
 * error message ("set `agent:` in harness.config.yaml") long before anything
 * created it, so every project had to hand-copy it out of a guide. A tool that
 * documents a config file and never writes one is asking its users to do the
 * scaffolder's job.
 *
 * Usage:
 *   specgate harness init [--project-dir <dir>] [--test-cmd <cmd>]
 *                                       [--force] [--stdout] [--json]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { renderTemplate } from "../../packages/core/src/domain/PackSpec";
import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson } from "../lib/agent";
import { error, info, warning, errorMessage } from "../lib/diagnostics";
import { BaseCommand } from "../lib/command";
import {
  detectTestCommand as detectSharedTestCommand,
  hasGherkinRunner as detectGherkinRunner,
} from "../../packages/core/src/domain/TestCommand";

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const TEMPLATES = path.join(ROOT_DIR, "templates", "harness");

const CONFIG_FILE = "harness.config.yaml";
const PREFIX_FILE = path.join(".harness", "prompt-prefix.md");

const NULL_SHAPE = { projectDir: null, files: [] };

/**
 * Guess the project's extra gate from the build file that is actually present,
 * or `null` when nothing gives it away.
 *
 * `null` matters more than the guesses. `test_cmd` is an *additional* gate —
 * `harness run` always runs `validate --strict` first — so leaving it
 * unset is safe, while filling it with a placeholder is not. A placeholder
 * like `echo "set this"` exits 0, which is a gate that passes unconditionally:
 * the harness would mark requirements done without ever running a test. A
 * freshly scaffolded project has no build file yet precisely because no code
 * exists, so this is the common case, not the edge one.
 */
/**
 * What a fresh worktree needs before anything runs in it: the dependency
 * install the lockfile pins. `null` when nothing here says.
 */
export function setupCommand(projectDir: string): string {
  const has = (f: string) => fs.existsSync(path.join(projectDir, f));
  const cmd = has("package-lock.json")
    ? "npm ci --silent --no-audit --no-fund"
    : has("pnpm-lock.yaml")
      ? "pnpm install --frozen-lockfile"
      : has("yarn.lock")
        ? "yarn install --frozen-lockfile"
        : "";
  return cmd
    ? `setup_cmd: "${cmd}"`
    : '# setup_cmd: "npm ci"   # ← run in each fresh worktree before the agent';
}

export function detectTestCommand(projectDir) {
  // One detector, shared with `adopt`/`onboard`. They used to disagree on the
  // same pom.xml — `./mvnw -B test` there, `mvn -B test` here — which a cold
  // evaluator found by running both. `preferVerify` is the one intentional
  // difference, and it is an argument so that it stays intentional.
  return detectSharedTestCommand(
    {
      exists: (rel) => fs.existsSync(path.join(projectDir, rel)),
      read: (rel) => {
        try {
          return fs.readFileSync(path.join(projectDir, rel), "utf8");
        } catch {
          return null;
        }
      },
    },
    { preferVerify: true }
  );
}

export function projectName(projectDir) {
  const specPath = path.join(projectDir, "spec.md");
  if (fs.existsSync(specPath)) {
    const heading = /^#\s+(.+)$/m.exec(fs.readFileSync(specPath, "utf8"));
    if (heading) return heading[1].trim();
  }
  return path.basename(projectDir);
}

function usage() {
  process.stdout.write(
    "\n  🤖 harness init — scaffold the harness configuration\n\n" +
      "  USAGE\n" +
      "    specgate harness init [options]\n\n" +
      "  WRITES\n" +
      `    ${CONFIG_FILE}        agent, gate, retries, CI mode\n` +
      `    ${PREFIX_FILE}   Role / Active Project Boundary / Execution Policy\n\n` +
      "  OPTIONS\n" +
      "    --project-dir <dir>  Project root (auto-detected from cwd if omitted).\n" +
      "    --test-cmd <cmd>     The gate. Detected from the build files if omitted.\n" +
      "    --force              Overwrite files that already exist.\n" +
      "    --stdout             Print both files instead of writing them.\n" +
      "    --json               Machine-readable output.\n" +
      "    -h, --help           Show this help.\n\n"
  );
}

/** Parsed command-line options for this command. */
export interface HarnessInitOptions {
  projectDir: string;
  testCmd: string | null;
  force: boolean;
  stdout: boolean;
  json: boolean;
}

function parseArgs(argv) {
  const opts: HarnessInitOptions = {
    projectDir: ".",
    testCmd: null,
    force: false,
    stdout: false,
    json: wantsJson(argv),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) opts.projectDir = argv[++i];
    else if (a === "--test-cmd" && argv[i + 1]) opts.testCmd = argv[++i];
    else if (a === "--force") opts.force = true;
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "--json") continue;
    else if (a === "--format" && argv[i + 1] === "json") i++;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

export class InitCommand extends BaseCommand {
  public execute() {
    let argv = this.args;
    // Reachable as `harness init …` through the dispatcher, or directly.
    if (argv[0] === "harness") argv = argv.slice(1);
    if (argv[0] === "init") argv = argv.slice(1);

    const opts = parseArgs(argv);
    const io = agentIo(opts.json);

    let projectDir;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
    } catch (err) {
      io.usage(NULL_SHAPE, [
        error("no_project", errorMessage(err), {
          fix: "Run from inside a spec-driven project, or pass --project-dir <path>.",
        }),
      ]);
      return;
    }

    const testCmd = opts.testCmd || detectTestCommand(projectDir);
    // Rendered into the config as a live key when known, and as a commented-out
    // one when not — see detectTestCommand for why a placeholder would be worse
    // than an absent key.
    // Shared with `doctor`, which used to call a Gherkin quality check
    // "every scenario runnable" in projects where nothing runs one.
    const hasGherkinRunner = detectGherkinRunner({
      exists: (rel) => fs.existsSync(path.join(projectDir, rel)),
      read: (rel) => {
        try {
          return fs.readFileSync(path.join(projectDir, rel), "utf8");
        } catch {
          return null;
        }
      },
    });

    const vars = {
      PROJECT_NAME: projectName(projectDir),
      STEP_DEFS_LINE: hasGherkinRunner
        ? "- `features/step_definitions/**` and `features/support/**` — step definitions\n" +
          "  are code, not specification. This is the one place inside `features/` you\n" +
          "  own."
        : "\nThis project has no Gherkin runner, so nothing executes a `.feature` here.\n" +
          "The scenarios are the specification and your tests are the proof: write a\n" +
          "test per scenario that asserts what it says, in the project's own test\n" +
          "framework, and mention the requirement and scenario ids in it\n" +
          "(`REQ-NNN SCN-NNN`) — that mention is the link. Do not add a BDD runner.",
      SCENARIO_STEP: hasGherkinRunner
        ? "2. Write or extend the step definitions so the scenario fails **for the right\n" +
          "   reason** — a missing implementation, not a typo in a step."
        : "2. Write a test per scenario, mentioning its ids, so it fails **for the right\n" +
          "   reason** — a missing implementation, not a typo in the test.",
      SETUP_CMD_LINE: setupCommand(projectDir),
      TEST_CMD_LINE: testCmd
        ? `test_cmd: "${testCmd}"`
        : '# test_cmd: "npm test"   # ← set this once the project has a test command',
      GATE_COMMAND: testCmd
        ? `${testCmd}\n   specgate validate . --strict`
        : "specgate validate . --strict",
    };

    const outputs = [
      {
        dest: CONFIG_FILE,
        body: renderTemplate(
          fs.readFileSync(path.join(TEMPLATES, "harness.config.yaml.tpl"), "utf8"),
          vars
        ),
      },
      {
        dest: PREFIX_FILE,
        body: renderTemplate(
          fs.readFileSync(path.join(TEMPLATES, "prompt-prefix.md.tpl"), "utf8"),
          vars
        ),
      },
    ];

    if (opts.stdout) {
      io.emit({ projectDir, testCmd, files: outputs.map((o) => o.dest) }, () => {
        for (const out of outputs) {
          process.stdout.write(
            `# ── ${out.dest} ${"─".repeat(Math.max(0, 60 - out.dest.length))}\n`
          );
          process.stdout.write(out.body);
          process.stdout.write("\n");
        }
      });
      return;
    }

    const existing = outputs
      .map((o) => o.dest)
      .filter((dest) => fs.existsSync(path.join(projectDir, dest)));
    if (existing.length > 0 && !opts.force) {
      io.fail({ ...NULL_SHAPE, projectDir }, [
        error("harness_config_exists", `Already present: ${existing.join(", ")}`, {
          target: existing[0],
          fix: "Re-run with --force to overwrite, or --stdout to print and merge by hand.",
        }),
      ]);
      return;
    }

    const written = [];
    for (const out of outputs) {
      const abs = path.join(projectDir, out.dest);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, out.body, "utf8");
      written.push(out.dest);
    }

    // Registered here because this is where a project is set up to run the
    // harness, and the driver only matters once branches come back in parallel.
    const driverProblem = installMergeDriver(projectDir);

    const status = [
      info("harness_agent_unset", "No agent is configured, deliberately.", {
        fix: 'Pass it explicitly: specgate harness run --req REQ-001 --agent "<cmd> < {prompt_file}"',
      }),
    ];
    if (driverProblem) status.push(driverProblem);
    else
      status.push(
        info(
          "merge_driver_registered",
          "docs/specs/traceability.md now merges row by row, so parallel harness branches do not collide.",
          {
            target: ".gitattributes",
            fix: "Commit .gitattributes. Every other clone and CI runs `specgate harness init` once to register the driver in its own git config.",
          }
        )
      );

    if (!testCmd) {
      status.push(
        warning(
          "harness_test_cmd_unset",
          "No test command detected, so `test_cmd` is commented out.",
          {
            target: CONFIG_FILE,
            fix: "Set it once the project has one. Until then the gate is `validate . --strict` alone, which is a real gate — a placeholder that exits 0 would not be.",
          }
        )
      );
    }

    io.emit(
      {
        projectDir,
        testCmd,
        files: written,
        status,
      },
      () => {
        for (const file of written) process.stdout.write(`ℹ️ [INFO] write ${file}\n`);
        // Warnings only reached `--json` before, so a text-mode user learned
        // that a tracked file had changed from `git status` instead of from the
        // command that changed it.
        for (const d of status) {
          if (d.severity !== "warning") continue;
          process.stderr.write(`⚠️ [WARN] ${d.message}\n`);
          if (d.fix) process.stderr.write(`💡 [FIX] ${d.fix}\n`);
        }
        process.stdout.write(
          "ℹ️ [INFO] ✅ Harness configured.\n" +
            `ℹ️ [INFO]   gate: validate . --strict${testCmd ? ` + ${testCmd}` : " (no test command detected)"}\n` +
            "ℹ️ [INFO]   agent: not set — that is your choice and your credentials.\n" +
            "ℹ️ [INFO] Next:\n" +
            "ℹ️ [INFO]   1. Read .harness/prompt-prefix.md and make it sound like your team.\n" +
            "ℹ️ [INFO]   2. specgate harness prompt REQ-001        — see it before paying for it\n" +
            'ℹ️ [INFO]   3. specgate harness run --req REQ-001 --agent "<cmd> < {prompt_file}"\n'
        );
      }
    );
  }
}

// ── the traceability merge driver ────────────────────────────────────────────

/** What `.gitattributes` must say for git to route the matrix to our driver. */
export const MERGE_DRIVER_NAME = "csda-matrix";
export const GITATTRIBUTES_LINE = `docs/specs/traceability.md merge=${MERGE_DRIVER_NAME}`;

/**
 * Register the row-wise merge driver for `docs/specs/traceability.md`.
 *
 * Parallel harness runs produce one branch per requirement, each flipping its
 * own row. Git merges by lines and needs an unchanged line between two changed
 * regions, so two edits one row apart collide even though they are independent
 * — measured: rows 1 and 2 conflict, rows 1 and 5 do not. The driver merges by
 * row instead. See `packages/core/src/domain/TraceabilityMerge.ts`.
 *
 * This takes two halves, and only the first is committed:
 *
 *   - `.gitattributes` routes the file. It is part of the repository, so every
 *     clone gets it.
 *   - `merge.csda-matrix.driver` is **local git config**, which nothing can
 *     commit. Each clone and each CI job registers it, and that is why
 *     `specgate doctor` checks for the gap.
 *
 * Without the config git falls back to its built-in merge — the conflict a
 * project has today. That fallback is deliberate: an unregistered checkout is
 * never silently wrong, only unhelped, so this can be adopted one clone at a
 * time.
 *
 * @returns a diagnostic when the driver could not be registered, else null
 */
export function installMergeDriver(projectDir: string) {
  const attributesPath = path.join(projectDir, ".gitattributes");
  const existing = fs.existsSync(attributesPath) ? fs.readFileSync(attributesPath, "utf8") : "";

  let appendedToTracked = false;
  if (!existing.includes(GITATTRIBUTES_LINE)) {
    // `.gitattributes` is committed, so appending to it changes a file the
    // whole team shares. A cold evaluator found this the way you always find a
    // silent write — in `git status`, after the fact — so the command says it.
    appendedToTracked = existing !== "";
    const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(
      attributesPath,
      `${separator}# Merge the traceability matrix row by row, so parallel harness\n` +
        `# branches do not collide on adjacent rows. Needs the driver registered:\n` +
        `#   specgate harness init --project-dir .\n` +
        `${GITATTRIBUTES_LINE}\n`,
      "utf8"
    );
  }

  // How the driver is addressed decides whether it works on anybody else's
  // clone.
  //
  // It used to be `node "/Users/someone/.../merge-traceability.js"` — the path
  // of whichever checkout ran `harness init` — while `.gitattributes` said
  // `merge=csda-matrix` and was committed. A cold evaluator found the pair: a
  // shared rule pointing at a directory that exists on one laptop.
  //
  // A project that has specgate in its own `node_modules` can be addressed
  // relatively, which every clone reproduces when it installs. Otherwise the
  // running CLI's own path is the only thing that works here and now — and
  // then the command says out loud that it is local, rather than leaving the
  // next person to find out during a merge.
  const localBin = path.join(
    projectDir,
    "node_modules",
    "@rsaglobaltech",
    "specgate",
    "bin",
    "specgate.js"
  );
  const driverIsPortable = fs.existsSync(localBin);
  const driverCommand = driverIsPortable
    ? `node node_modules/@rsaglobaltech/specgate/bin/specgate.js merge-traceability`
    : `node ${JSON.stringify(path.join(__dirname, "..", "merge-traceability.js"))}`;

  const gitConfig = (key: string, value: string) =>
    spawnSync("git", ["-C", projectDir, "config", key, value], { encoding: "utf8" });

  // Order matters, and getting it wrong is worse than not doing it at all.
  //
  // Git has three states for a driver named in .gitattributes:
  //
  //   neither `name` nor `driver` set  → falls back to the built-in merge.
  //                                      A fresh clone is here, and it is fine.
  //   `name` set, `driver` missing     → `fatal: custom merge driver
  //                                      csda-matrix lacks command line`. The
  //                                      file cannot be merged AT ALL — worse
  //                                      than the conflict this feature exists
  //                                      to remove.
  //   both set                         → the driver runs.
  //
  // So `driver` goes in first and `name` only follows if it landed; and if it
  // did not, any stale `name` is removed rather than left pointing at nothing.
  const configured = gitConfig(`merge.${MERGE_DRIVER_NAME}.driver`, `${driverCommand} %O %A %B`);

  if (configured.status !== 0) {
    spawnSync("git", ["-C", projectDir, "config", "--unset", `merge.${MERGE_DRIVER_NAME}.name`], {
      encoding: "utf8",
    });
    return warning(
      "merge_driver_not_registered",
      "Could not register the traceability merge driver in git config.",
      {
        target: ".gitattributes",
        fix:
          `Run it by hand inside the project:\n` +
          `  git config merge.${MERGE_DRIVER_NAME}.driver '${driverCommand} %O %A %B'\n` +
          "Until then git uses its built-in merge, which conflicts when two " +
          "harness branches touch adjacent rows.",
      }
    );
  }

  gitConfig(`merge.${MERGE_DRIVER_NAME}.name`, "csda traceability matrix merge");

  if (!driverIsPortable) {
    return warning(
      "merge_driver_is_machine_local",
      "The merge driver points at this machine's copy of specgate.",
      {
        target: ".gitattributes",
        fix:
          "`.gitattributes` is committed and names the driver; the driver itself is " +
          "local git config, so every other clone and CI runner must run `specgate " +
          "harness init` once or git falls back to its built-in merge (safe, just " +
          "noisier on parallel branches).\n" +
          "To make it reproducible instead, add specgate to the project: " +
          "`npm i -D @rsaglobaltech/specgate` and re-run this — the driver is then " +
          "a path inside node_modules that every clone rebuilds." +
          (appendedToTracked ? "\nThis also appended to your existing .gitattributes." : ""),
      }
    );
  }

  if (appendedToTracked) {
    return warning(
      "gitattributes_modified",
      "Appended a merge rule to your existing .gitattributes — a tracked file.",
      {
        target: ".gitattributes",
        fix: "Review and commit it. The rule is shared; the driver behind it is per-clone.",
      }
    );
  }
  return null;
}

if (require.main === module) new InitCommand(process.argv.slice(2)).execute();
