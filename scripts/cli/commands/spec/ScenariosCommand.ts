/**
 * `specgate scenarios <REQ> [--json]` (scenarios-run REQ-666): a requirement's
 * scenarios run one by one through the project's `bdd_cmd`, `{tags}` each
 * scenario's own tag, and which passed — for the studio's margin and the
 * requirement's way from what really ran.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import type { Diagnostic } from "../../../lib/diagnostics";
import { forShell } from "../../../lib/shell-command";
import * as ui from "../../../lib/ui";
import { readHarnessConfig } from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

const NULL_SHAPE = { scenarios: null };
const SCENARIO =
  /^\s*(Scenario Outline|Scenario Template|Scenario|Example|Esquema del escenario|Escenario|Ejemplo)\s*:\s*(.*)$/;

export interface ScenarioRef {
  id: string;
  name: string;
  /** Relative to the project, with `/`. */
  file: string;
  /** 1-based, its `Scenario:` line. */
  line: number;
}

/** Every scenario tagged with one of the requirement's `@SCN-` ids, in file then line order. */
export function scenariosOf(projectDir: string, req: string): ScenarioRef[] {
  const root = path.join(projectDir, "features");
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".feature")) files.push(full);
    }
  };
  walk(root);
  const out: ScenarioRef[] = [];
  for (const full of files.sort()) {
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    const rel = path.relative(projectDir, full).split(path.sep).join("/");
    let fileTags: string[] = [];
    let pending: string[] = [];
    let inFeature = false;
    lines.forEach((text, i) => {
      const t = text.trim();
      if (t.startsWith("@")) {
        pending.push(...t.split(/\s+/).filter((x) => x.startsWith("@")));
        return;
      }
      if (/^(Feature|Característica|Caracteristica|Funcionalidad)\s*:/.test(t)) {
        fileTags = pending;
        pending = [];
        inFeature = true;
        return;
      }
      const m = SCENARIO.exec(text);
      if (m && inFeature) {
        const tags = [...fileTags, ...pending];
        pending = [];
        const scn = tags.find((x) => /^@SCN-[\w-]+$/.test(x));
        if (scn && tags.includes(`@${req}`))
          out.push({ id: scn.slice(1), name: m[2].trim(), file: rel, line: i + 1 });
        return;
      }
      if (t && !t.startsWith("#")) pending = [];
    });
  }
  return out;
}

export class ScenariosCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(
        "Usage:\n  specgate scenarios <REQ-NNN> [--project-dir <path>] [--json]\n\n" +
          "Runs each scenario of the requirement through bdd_cmd, {tags} its @SCN tag,\n" +
          "one after the other, and says which passed.\n"
      );
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    let dir = ".";
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dir = argv[++i] || ".";
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for scenarios: ${a}`, {
            fix: "specgate scenarios --help",
          }),
        ]);
    }
    const req = positional[0] || "";
    if (!/^REQ-\d+$/.test(req))
      io.usage(NULL_SHAPE, [
        error("missing_argument", "Give the requirement: specgate scenarios REQ-031.", {
          fix: "specgate scenarios REQ-031",
        }),
      ]);
    const projectDir = path.resolve(dir);
    const bddCmd = (readHarnessConfig(projectDir)?.bddCmd || "").trim();
    if (!bddCmd)
      io.fail(NULL_SHAPE, [
        error("bdd_cmd_missing", "No bdd_cmd runs the feature files.", {
          fix: 'specgate config set bdd_cmd "<runs the feature files, with {tags}>"',
        }),
      ]);
    const scenarios = scenariosOf(projectDir, req);
    if (!scenarios.length)
      io.fail(NULL_SHAPE, [
        error(
          "scenarios_none",
          `${req} has no scenario tagged with its @SCN ids under features/.`,
          {
            target: req,
            fix: `specgate change features <change> — or tag its scenarios @${req} @SCN-…`,
          }
        ),
      ]);

    const results = scenarios.map((s) => {
      const tag = `@${s.id}`;
      const command = bddCmd.includes("{tags}")
        ? bddCmd.split("{tags}").join(tag)
        : `${bddCmd} ${tag}`;
      if (!json) process.stderr.write(ui.info(`Running ${s.id} — ${s.name}…`));
      const run = spawnSync(forShell(command), {
        cwd: projectDir,
        encoding: "utf8",
        shell: true,
        maxBuffer: 32 * 1024 * 1024,
      });
      const output = `${run.stdout || ""}${run.stderr || ""}`
        .trimEnd()
        .split("\n")
        .slice(-40)
        .join("\n");
      return { ...s, command, passed: run.status === 0, exit: run.status ?? 1, output };
    });
    const status: Diagnostic[] = results
      .filter((r) => !r.passed)
      .map((r) =>
        error("scenario_failed", `${r.id} — ${r.name} failed (exit ${r.exit}).`, {
          target: r.id,
          file: r.file,
          line: r.line,
          fix: `make it pass — its steps and the code — then specgate scenarios ${req}`,
        } as never)
      );
    const document = {
      scenarios: {
        requirement: req,
        results,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
      },
      status,
    };
    io.emitAndGate(document, () => {
      process.stdout.write(ui.header("scenarios", req));
      for (const r of results)
        process.stdout.write(
          r.passed ? ui.ok(`${r.id} — ${r.name}`) : ui.fail(`${r.id} — ${r.name} (exit ${r.exit})`)
        );
    });
  }
}
