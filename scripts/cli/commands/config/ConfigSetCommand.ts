import * as fs from "node:fs";
import * as path from "node:path";
import { error, printDiagnostics, type Diagnostic } from "../../../lib/diagnostics";
import { agentIo, wantsJson, EXIT, AgentIo } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import {
  HARNESS_CONFIG_FILE,
  readHarnessConfig,
  writeHarnessCommand,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";
import { withAgentPermission, withLiveStream } from "../../../lib/agent-permission";
import {
  CATALOG,
  CONFIG_JSON_FILE,
  HARNESS_FILE,
  catalog,
  currentValue,
  presentKeys,
  resolveKey,
  setYamlKey,
  unknownKeyFix,
  unsetYamlKey,
} from "../../../lib/config-keys";

export const CONFIG_DIR = ".specgate";
export const CONFIG_FILE = "config.json";

export const KEYS: Record<string, { values: string[] | null; describe: string }> = {
  profile: {
    values: ["core", "full"],
    describe: "Which commands `specgate --help` lists by default.",
  },
  language: {
    values: null,
    describe: "Language for generated prose. Technical terms stay in English.",
  },
  pet: {
    values: ["on", "off"],
    describe: "Whether Gato, the cat that keeps the gate, shows up at the end of `status`.",
  },
  agent_guard: {
    values: ["on", "off"],
    describe:
      "Whether the agent plugins refuse an edit to source code until a test names the requirement.",
  },
  test_cmd: {
    values: null,
    describe: `The command \`check\` and \`done\` run as your tests. Kept in ${HARNESS_CONFIG_FILE}.`,
  },
  arch_cmd: {
    values: null,
    describe: `Your architecture check (ArchUnit, dependency-cruiser…), run by the gate before the tests. Kept in ${HARNESS_CONFIG_FILE}.`,
  },
  agent: {
    values: null,
    describe: `The agent \`harness run\` and the studio's Build hand each requirement to, with {prompt_file}. Kept in ${HARNESS_CONFIG_FILE}.`,
  },
};

/**
 * `test_cmd` lives in harness.config.yaml, not here: `check`, `done` and the
 * harness already read it there, and a second home would be two answers to
 * "which tests does the gate run" (#68).
 */
const HARNESS_KEYS = new Set(["test_cmd", "arch_cmd", "agent"]);

function harnessCommand(projectDir: string, key: string): string | null {
  try {
    const harness = readHarnessConfig(projectDir) || {};
    if (key === "agent") return harness.agent ?? null;
    return (key === "arch_cmd" ? harness.archCmd : harness.testCmd) ?? null;
  } catch {
    return null;
  }
}

/**
 * REQ-563: why harness.config.yaml cannot be read, as a finding — or null.
 * `config list` answered `{}` for a file it could not read, and a tool showed
 * the agent and the tests as unset instead of the file as broken.
 */
export function harnessConfigProblem(projectDir: string): Diagnostic | null {
  try {
    readHarnessConfig(projectDir);
    return null;
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    const [what, ...rest] = text.split("\n");
    const fix = rest
      .join(" ")
      .replace(/^Fix:\s*/, "")
      .trim();
    return error("harness_config_invalid", what, {
      file: "harness.config.yaml",
      ...(fix ? { fix } : {}),
    });
  }
}

export function configPath(projectDir: string) {
  return path.join(projectDir, CONFIG_DIR, CONFIG_FILE);
}

/** `.specgate/config.json`: setting name → value. */
export type ProjectConfig = Record<string, unknown>;

export function read(projectDir: string): ProjectConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(projectDir), "utf8")) as ProjectConfig;
  } catch {
    return {};
  }
}

export function write(projectDir: string, config: ProjectConfig): string {
  const file = configPath(projectDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return file;
}

/** The file a key is kept in, relative to the project, with forward slashes (REQ-505). */
function fileOf(key: string): string {
  if (HARNESS_KEYS.has(key)) return HARNESS_FILE;
  const r = resolveKey(key);
  return r ? r.spec.file : CONFIG_JSON_FILE;
}

const filesOf = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, fileOf(k)]));

function usage() {
  const keys = CATALOG.map((v) => {
    const allowed = v.values ? ` (${v.values.join(" | ")})` : "";
    return `    ${v.key}${allowed}\n      ${v.description} ${v.file}`;
  }).join("\n");
  process.stdout.write(
    "Usage:\n" +
      "  specgate config set <key> <value>\n" +
      '  specgate config set test_cmd "npm test"\n' +
      '  specgate config set profiles.fast.agent "claude -p < {prompt_file}"\n' +
      '  specgate config set checks.lint.run "npm run lint"\n' +
      "  specgate config set alm.token_env JIRA_TOKEN\n" +
      "  specgate config get <key>\n" +
      "  specgate config list\n" +
      "  specgate config keys       every key, its values, default, current value and file\n\n" +
      `Keys (<name> is a profile's or a check's name):\n${keys}\n\n` +
      "With --json, get, set and list say the file each key is kept in, under files.\n" +
      "Tokens are never stored: an *_env key names the variable that holds one.\n" +
      "Commit the files to share the settings.\n"
  );
}

export class ConfigSetCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    const io: AgentIo = agentIo(wantsJson(argv));
    const NULL_SHAPE = { config: null };
    const args = argv.filter((a) => a !== "--json");

    if (args.includes("--help") || args.includes("-h")) {
      usage();
      process.exit(EXIT.OK);
    }

    let projectDir = ".";
    const positional = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--project-dir" && args[i + 1]) projectDir = args[++i];
      // A negative number is a value, not a flag: `config set … -1` is refused as a value.
      else if (!args[i].startsWith("-") || /^-\d/.test(args[i])) positional.push(args[i]);
    }

    const [action, key, ...rest] = positional;

    // REQ-506: the catalog, each key with its values, default, value and file.
    if (action === "keys") {
      const base = read(projectDir);
      const keys = catalog(projectDir, (k) => {
        if (HARNESS_KEYS.has(k)) return harnessCommand(projectDir, k);
        const v = base[k];
        return v === undefined || v === null ? null : (v as string);
      });
      io.emit({ keys }, () => {
        for (const k of keys) {
          const shown = k.current === null ? "(default)" : String(k.current);
          process.stdout.write(`  ${k.key} = ${shown}\n      ${k.description} ${k.file}\n`);
        }
      });
      return;
    }

    if (action === "list" || (!action && !key)) {
      const config = read(projectDir);
      for (const k of HARNESS_KEYS) {
        const v = harnessCommand(projectDir, k);
        if (v !== null) config[k] = v;
      }
      for (const k of presentKeys(projectDir)) config[k] = currentValue(projectDir, k);
      const problem = harnessConfigProblem(projectDir);
      io.emitAndGate(
        { config, files: filesOf(Object.keys(config)), status: problem ? [problem] : [] },
        () => {
          if (problem) printDiagnostics([problem]);
          const entries = Object.entries(config);
          if (entries.length === 0) {
            process.stdout.write("  (no settings — everything is at its default)\n");
            return;
          }
          for (const [k, v] of entries) process.stdout.write(`  ${k} = ${v}\n`);
        }
      );
      return;
    }

    // config-agents REQ-707: a key, a profile or the sandbox, removed.
    if (action === "unset") {
      if (!key) {
        io.usage(NULL_SHAPE, [
          error("config_key_unknown", "Name the key to remove.", {
            fix: "specgate config unset profiles.careful   ·   specgate config unset sandbox",
          }),
        ]);
      }
      const gone = unsetYamlKey(projectDir, key);
      if (gone.ok === false) {
        io.usage(NULL_SHAPE, [
          error("config_key_unknown", gone.message, { target: key, fix: gone.fix }),
        ]);
      }
      const done = gone as { file: string; removed: boolean };
      io.emit({ config: { [key]: null }, removed: done.removed, files: { [key]: done.file } }, () =>
        process.stdout.write(
          done.removed
            ? `  ✔  ${key} removed\n     ${done.file}\n`
            : `  ${key} was not set: nothing to remove\n`
        )
      );
      process.exit(EXIT.OK);
    }

    const resolved = KEYS[key] ? null : resolveKey(key);
    if (!KEYS[key] && !resolved) {
      io.usage(NULL_SHAPE, [
        error("config_key_unknown", `Unknown setting: ${key || "(none)"}`, {
          target: key,
          fix: /^(alm|profiles|checks)\./.test(key || "")
            ? unknownKeyFix(key)
            : `Known settings: ${Object.keys(KEYS).join(", ")}; \`specgate config keys\` lists every one.`,
        }),
      ]);
    }

    if (action === "get") {
      const config = read(projectDir);
      if (HARNESS_KEYS.has(key)) config[key] = harnessCommand(projectDir, key);
      if (resolved) config[key] = currentValue(projectDir, key);
      io.emit({ config: { [key]: config[key] ?? null }, files: filesOf([key]) }, () =>
        process.stdout.write(`  ${key} = ${config[key] ?? "(default)"}\n`)
      );
      return;
    }

    if (action !== "set") {
      io.usage(NULL_SHAPE, [
        error("config_action_unknown", `Unknown action: ${action || "(none)"}`, {
          target: action,
          fix: "Use one of: set, unset, get, list, keys.",
        }),
      ]);
    }

    // `config set test_cmd npm test` and `… "npm test"` mean the same command.
    const value = (HARNESS_KEYS.has(key) || resolved) && rest.length > 0 ? rest.join(" ") : rest[0];
    if (value === undefined) {
      io.usage(NULL_SHAPE, [
        error("config_value_required", `No value given for ${key}.`, {
          fix: `specgate config set ${key} <value>`,
        }),
      ]);
    }

    // REQ-507, REQ-508: profiles, quality checks and ALM, into their YAML file.
    if (resolved) {
      const outcome = setYamlKey(projectDir, key, value);
      if (outcome.ok === false) {
        io.usage(NULL_SHAPE, [
          error("config_value_invalid", outcome.message, { target: value, fix: outcome.fix }),
        ]);
      }
      const written = outcome as { file: string; value: unknown };
      io.emit({ config: { [key]: written.value }, files: filesOf([key]) }, () =>
        process.stdout.write(`  ✔  ${key} = ${value}\n     ${written.file}\n`)
      );
      process.exit(EXIT.OK);
    }

    const allowed = KEYS[key].values;
    if (allowed && !allowed.includes(value)) {
      io.usage(NULL_SHAPE, [
        error("config_value_invalid", `${value} is not a valid ${key}.`, {
          target: value,
          fix: `Use one of: ${allowed.join(", ")}.`,
        }),
      ]);
    }

    // guard-switch-person REQ-768: switching the guard off is a person's act, said at a terminal.
    if (
      key === "agent_guard" &&
      value === "off" &&
      !process.stdin.isTTY &&
      !process.env.SPECGATE_ASSUME_TTY
    ) {
      io.fail(NULL_SHAPE, [
        error(
          "guard_needs_person",
          "Switching the guard off is a person's act, and this is not a terminal. Nothing was written.",
          {
            target: key,
            fix: "A person runs it in a terminal: specgate config set agent_guard off",
          }
        ),
      ]);
      return;
    }

    if (HARNESS_KEYS.has(key)) {
      if (value.trim() === "") {
        io.usage(NULL_SHAPE, [
          error("config_value_required", `${key} cannot be empty.`, {
            fix:
              key === "arch_cmd"
                ? 'specgate config set arch_cmd "./mvnw -q test -Dtest=ArchitectureTest"'
                : 'specgate config set test_cmd "npm test"',
          }),
        ]);
      }
      // REQ-271: the agent, with the permission the harness would add (REQ-264).
      if (key === "agent" && !value.includes("{prompt_file}")) {
        io.usage(NULL_SHAPE, [
          error(
            "config_value_invalid",
            "The agent command needs {prompt_file}: the prompt goes there.",
            {
              fix: 'specgate config set agent "claude -p < {prompt_file}"',
            }
          ),
        ]);
      }
      // REQ-278: a bare Claude Code agent is also streamed into the live view.
      const kept = key === "agent" ? withLiveStream(withAgentPermission(value).command) : value;
      const file = writeHarnessCommand(projectDir, key as "test_cmd" | "arch_cmd" | "agent", kept);
      io.emit({ config: { [key]: kept }, files: filesOf([key]) }, () =>
        process.stdout.write(
          `  ✔  ${key} = ${kept}\n     ${path.relative(process.cwd(), file) || file}\n` +
            (key === "agent"
              ? "     `harness run` and the studio's Build now run it.\n"
              : "     `check` and `apply` now run it.\n")
        )
      );
      process.exit(EXIT.OK);
    }

    const config = read(projectDir);
    config[key] = value;
    const file = write(projectDir, config);

    io.emit({ config, files: filesOf(Object.keys(config)) }, () =>
      process.stdout.write(
        `  ✔  ${key} = ${value}\n     ${path.relative(process.cwd(), file) || file}\n`
      )
    );
    process.exit(EXIT.OK);
  }
}
