import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { detectStacks, presetYaml, withPreset, type Level } from "../../../lib/quality-presets";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import {
  HARNESS_CONFIG_FILE,
  readHarnessConfig,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import type { QualityConfig, Stage } from "../../../../packages/core/src/domain/QualityChecks";
import {
  dockerAvailable,
  ensureImage,
  gateContext,
  resolveRunner,
  archCheck,
  runCheck,
  runStages,
  sarifFindings,
  stagesPassed,
} from "../../../lib/quality-run";
import { acceptFindings } from "../../../../packages/core/src/domain/Sarif";
import {
  QUALITY_BASELINE_FILE,
  readBaseline,
  writeBaseline,
} from "../../../../packages/core/src/infrastructure/QualityBaselineFile";

const NULL_SHAPE = { quality: null };

function usage(): void {
  process.stdout.write(
    `
  🔍 ${c.bold}specgate quality${c.reset} <init|list|doctor|run|baseline> [options]

  The quality and security checks of harness.config.yaml (ADR-0040).

    init [--level basic|strict] [--force]
                             write the checks of a level for the stack this project uses
                             (Maven, Gradle, npm/pnpm) — all in Docker, no account needed
    list                     each check: when it runs, whether it gates, how it runs here
    doctor [--pull]          the same, with what is missing; --pull fetches the images now
    run [--stage <s>] [--req <REQ>] [--base <ref>]
                             run the checks of a stage (attempt, end, ci; default attempt and end)
    baseline [--accept <check>]
                             run every check that writes SARIF and record its findings as the
                             debt that exists today, in .specgate/quality-baseline.json (commit
                             it); from then on only new findings fail. --accept: that check only

  Options: --project-dir <dir>, --json.

`
  );
}

export class QualityCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    const sub = argv[0];
    let projectDirArg = ".";
    let stage = "";
    let req = "";
    let base = "";
    let pull = false;
    let accept = "";
    let level = "basic";
    let force = false;
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") projectDirArg = argv[++i] || ".";
      else if (a === "--stage") stage = argv[++i] || "";
      else if (a === "--req") req = argv[++i] || "";
      else if (a === "--base") base = argv[++i] || "";
      else if (a === "--pull") pull = true;
      else if (a === "--accept") accept = argv[++i] || "";
      else if (a === "--level") level = argv[++i] || "";
      else if (a === "--force") force = true;
      else if (a === "--json") continue;
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for quality: ${a}`, {
            fix: "specgate quality --help",
          }),
        ]);
    }
    if (!["init", "list", "doctor", "run", "baseline"].includes(sub)) {
      io.usage(NULL_SHAPE, [
        error("unknown_subcommand", `quality has no ${sub}.`, { fix: "specgate quality --help" }),
      ]);
    }
    if (stage && !["attempt", "end", "ci"].includes(stage)) {
      io.usage(NULL_SHAPE, [
        error("quality_stage", `--stage is attempt, end or ci, not ${stage}.`, {
          fix: "specgate quality run --stage end",
        }),
      ]);
    }
    if (req && !/^REQ-\d+$/.test(req)) {
      io.usage(NULL_SHAPE, [
        error("quality_req", `--req takes a requirement id like REQ-007.`, {
          fix: "specgate quality run --req REQ-007",
        }),
      ]);
    }

    const projectDir = resolveProjectDir(projectDirArg);

    if (sub === "init") {
      // REQ-225: the checks of a level, for the stack the build files give away.
      if (level !== "basic" && level !== "strict") {
        io.usage(NULL_SHAPE, [
          error("quality_level", `--level is basic or strict, not ${level}.`, {
            fix: "specgate quality init --level strict",
          }),
        ]);
      }
      const file = path.join(projectDir, HARNESS_CONFIG_FILE);
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "harness_version: 1\n";
      if (/^checks:/m.test(current) && !force) {
        io.fail(NULL_SHAPE, [
          error("quality_exists", "harness.config.yaml already lists checks.", {
            fix: "specgate quality init --force replaces them (every other line is kept).",
          }),
        ]);
      }
      const stacks = detectStacks(projectDir);
      fs.writeFileSync(file, withPreset(current, presetYaml(projectDir, level as Level)), "utf8");
      const written = readHarnessConfig(projectDir) || {};
      const checks = written.quality ? written.quality.checks.map((c) => c.name) : [];
      io.emit({ quality: { level, stacks, checks, file: HARNESS_CONFIG_FILE } }, () => {
        process.stdout.write(
          ui.header("quality init", `${level} · ${stacks.join(", ") || "node"}`)
        );
        process.stdout.write(
          `  ${checks.join(", ")}\n\n  ${ui.muted("All in Docker. Next: specgate quality doctor --pull, then specgate quality baseline.")}\n\n`
        );
      });
      return;
    }

    let quality: QualityConfig | undefined;
    try {
      quality = (readHarnessConfig(projectDir) || {}).quality;
    } catch (err) {
      io.fail(NULL_SHAPE, [
        error("quality_config", (err as Error).message, { fix: "Correct harness.config.yaml." }),
      ]);
    }
    const config: QualityConfig = quality || {
      level: "",
      diffCoverage: null,
      mutationScore: null,
      checks: [],
      commitTypes: [],
    };

    if (sub === "list" || sub === "doctor") {
      const rows = config.checks.map((check) => {
        const how = resolveRunner(check);
        let pulled: string | null = null;
        if (pull && "runner" in how && how.runner === "docker") {
          const r = ensureImage(check.image);
          pulled = r.ok ? "pulled" : r.message;
        }
        return {
          name: check.name,
          when: check.when,
          gate: check.gate,
          runner: "runner" in how ? how.runner : null,
          image: check.image || null,
          unavailable: "skip" in how ? how.skip : null,
          ...(pulled ? { pulled } : {}),
        };
      });
      io.emit(
        {
          quality: {
            level: config.level || null,
            diffCoverage: config.diffCoverage,
            mutationScore: config.mutationScore,
            docker: sub === "doctor" ? dockerAvailable() : undefined,
            checks: rows,
          },
        },
        () => {
          process.stdout.write(ui.header(`quality ${sub}`));
          if (rows.length === 0) {
            process.stdout.write(
              `  ${ui.muted("No checks: add checks: to harness.config.yaml (ADR-0040).")}\n\n`
            );
            return;
          }
          for (const r of rows) {
            const how = r.runner
              ? `${r.runner}${r.image && r.runner === "docker" ? ` ${r.image.split("@")[0]}` : ""}`
              : "not runnable";
            const line = `${r.name.padEnd(18)} ${r.when.padEnd(8)} ${(r.gate ? "gates" : "advises").padEnd(8)} ${how}`;
            process.stdout.write(
              r.unavailable
                ? ui.warn(`${line} — ${r.unavailable}`) + "\n"
                : `  ${line}${r.pulled ? ui.muted(` · ${r.pulled}`) : ""}\n`
            );
          }
          if (sub === "doctor") {
            process.stdout.write(
              `\n  ${ui.muted(`Docker ${dockerAvailable() ? "answers" : "does not answer"}. Thresholds: diff coverage ${config.diffCoverage ?? "—"} %, mutation score ${config.mutationScore ?? "—"} %.`)}\n`
            );
          }
          process.stdout.write("\n");
        }
      );
      return;
    }

    if (sub === "baseline") {
      // REQ-222: the debt that exists today, recorded so that only new findings fail.
      // REQ-231: arch_cmd with arch_sarif is baselined as the check `arch`.
      const harnessCfg = readHarnessConfig(projectDir) || {};
      const withArch =
        harnessCfg.archCmd && harnessCfg.archSarif
          ? [...config.checks, archCheck(harnessCfg.archCmd, harnessCfg.archSarif)]
          : config.checks;
      const targets = withArch.filter((c) => c.sarif && (!accept || c.name === accept));
      if (accept && targets.length === 0) {
        io.usage(NULL_SHAPE, [
          error("quality_accept", `No check named ${accept} writes SARIF.`, {
            fix: "specgate quality list",
          }),
        ]);
      }
      if (targets.length === 0) {
        io.fail(NULL_SHAPE, [
          error(
            "quality_no_sarif",
            "No check writes SARIF: there is nothing to take a baseline of.",
            {
              fix: "Add sarif: <path> to the checks whose tool writes it (ADR-0040).",
            }
          ),
        ]);
      }
      const ctx = { ...gateContext(projectDir, "", base), changedFiles: [] };
      let baseline = readBaseline(projectDir);
      const taken: Array<{ name: string; findings: number | null; skipped: string }> = [];
      if (!json) process.stdout.write(ui.header("quality baseline"));
      for (const check of targets) {
        const outcome = json
          ? runCheck(projectDir, check, ctx)
          : ui.task(
              check.name,
              () => runCheck(projectDir, check, ctx),
              (o) => ({ ok: !o.skipped })
            );
        const findings = outcome.skipped ? null : sarifFindings(projectDir, check);
        if (findings) baseline = acceptFindings(baseline, check.name, findings);
        taken.push({
          name: check.name,
          findings: findings ? findings.length : null,
          skipped: outcome.skipped || (findings ? "" : `it wrote no SARIF at ${check.sarif}`),
        });
      }
      writeBaseline(projectDir, baseline);
      io.emit(
        { quality: { baseline: QUALITY_BASELINE_FILE.split("\\").join("/"), checks: taken } },
        () => {
          for (const t of taken) {
            process.stdout.write(
              t.findings === null
                ? ui.warn(`${t.name}: not recorded — ${t.skipped}`) + "\n"
                : `  ${t.name.padEnd(18)} ${t.findings} finding(s) accepted as existing debt\n`
            );
          }
          process.stdout.write(
            `\n  ${ui.muted(`Written to ${QUALITY_BASELINE_FILE.split("\\").join("/")}: commit it. Only new findings fail from now on.`)}\n\n`
          );
        }
      );
      return;
    }

    // run
    const stages: Stage[] = stage ? [stage as Stage] : ["attempt", "end"];
    const ctx = gateContext(projectDir, req, base);
    if (!json) process.stdout.write(ui.header("quality run", stages.join(" + ")));
    const outcomes = runStages(projectDir, config, stages, ctx, (check, run) =>
      json ? run() : ui.task(`${check.name}`, run, (o) => ({ ok: o.ok || !!o.skipped || !o.gate }))
    );
    if (!json) {
      for (const o of outcomes) {
        if (o.skipped) process.stdout.write(`  ${ui.muted(`${o.name}: not run — ${o.skipped}`)}\n`);
        else if (!o.ok && o.output)
          process.stdout.write(
            o.output
              .split("\n")
              .map((l) => `     ${l}`)
              .join("\n") + "\n"
          );
      }
    }
    const ok = stagesPassed(outcomes, stages.includes("ci"));
    const shape = {
      quality: { stages, outcomes: outcomes.map(({ output: _o, ...rest }) => rest) },
    };
    if (!ok) {
      io.fail(shape, [
        error(
          "quality_failed",
          `Failed: ${outcomes
            .filter((o) => o.gate && (o.skipped ? stages.includes("ci") : !o.ok))
            .map((o) => o.name)
            .join(", ")}.`,
          { fix: "Fix what the checks report, then run `specgate quality run` again." }
        ),
      ]);
    }
    io.emit(shape, () =>
      process.stdout.write(
        `\n  ${c.ok}${ui.sym.ok}${c.reset}  ${outcomes.length} check(s) passed or advised\n\n`
      )
    );
  }
}
