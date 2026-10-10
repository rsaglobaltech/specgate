import * as fs from "node:fs";
import * as path from "node:path";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson, EXIT } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import {
  HARNESS_CONFIG_FILE,
  readHarnessConfig,
  writeHarnessTestCmd,
} from "../../../../packages/core/src/infrastructure/HarnessConfigFile";

export const CONFIG_DIR = ".csda";
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
  test_cmd: {
    values: null,
    describe: `The command \`check\` and \`done\` run as your tests. Kept in ${HARNESS_CONFIG_FILE}.`,
  },
};

/**
 * `test_cmd` lives in harness.config.yaml, not here: `check`, `done` and the
 * harness already read it there, and a second home would be two answers to
 * "which tests does the gate run" (#68).
 */
const HARNESS_KEYS = new Set(["test_cmd"]);

function harnessTestCmd(projectDir: string): string | null {
  try {
    return (readHarnessConfig(projectDir) || {}).testCmd ?? null;
  } catch {
    return null;
  }
}

export function configPath(projectDir: string) {
  return path.join(projectDir, CONFIG_DIR, CONFIG_FILE);
}

export function read(projectDir: string) {
  try {
    return JSON.parse(fs.readFileSync(configPath(projectDir), "utf8"));
  } catch {
    return {};
  }
}

export function write(projectDir: string, config: any) {
  const file = configPath(projectDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return file;
}

function usage() {
  const keys = Object.entries(KEYS)
    .map(([k, v]: [string, any]) => {
      const allowed = v.values ? ` (${v.values.join(" | ")})` : "";
      return `    ${k}${allowed}\n      ${v.describe}`;
    })
    .join("\n");
  process.stdout.write(
    "Usage:\n" +
      "  specgate config set <key> <value>\n" +
      '  specgate config set test_cmd "npm test"\n' +
      "  specgate config get <key>\n" +
      "  specgate config list\n\n" +
      `Keys:\n${keys}\n\n` +
      `Stored in ${CONFIG_DIR}/${CONFIG_FILE} (test_cmd in ${HARNESS_CONFIG_FILE}).\n` +
      "Commit it to share the setting.\n"
  );
}

export class ConfigSetCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    const io = agentIo(wantsJson(argv));
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
      else if (!args[i].startsWith("-")) positional.push(args[i]);
    }

    const [action, key, ...rest] = positional;

    if (action === "list" || (!action && !key)) {
      const config = read(projectDir);
      const testCmd = harnessTestCmd(projectDir);
      if (testCmd !== null) config.test_cmd = testCmd;
      io.emit({ config }, () => {
        const entries = Object.entries(config);
        if (entries.length === 0) {
          process.stdout.write("  (no settings — everything is at its default)\n");
          return;
        }
        for (const [k, v] of entries) process.stdout.write(`  ${k} = ${v}\n`);
      });
      return;
    }

    if (!KEYS[key]) {
      io.usage(NULL_SHAPE, [
        error("config_key_unknown", `Unknown setting: ${key || "(none)"}`, {
          target: key,
          fix: `Known settings: ${Object.keys(KEYS).join(", ")}.`,
        }),
      ]);
    }

    if (action === "get") {
      const config = read(projectDir);
      if (HARNESS_KEYS.has(key)) config[key] = harnessTestCmd(projectDir);
      io.emit({ config: { [key]: config[key] ?? null } }, () =>
        process.stdout.write(`  ${key} = ${config[key] ?? "(default)"}\n`)
      );
      return;
    }

    if (action !== "set") {
      io.usage(NULL_SHAPE, [
        error("config_action_unknown", `Unknown action: ${action || "(none)"}`, {
          target: action,
          fix: "Use one of: set, get, list.",
        }),
      ]);
    }

    // `config set test_cmd npm test` and `… "npm test"` mean the same command.
    const value = HARNESS_KEYS.has(key) && rest.length > 0 ? rest.join(" ") : rest[0];
    if (value === undefined) {
      io.usage(NULL_SHAPE, [
        error("config_value_required", `No value given for ${key}.`, {
          fix: `specgate config set ${key} <value>`,
        }),
      ]);
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

    if (HARNESS_KEYS.has(key)) {
      if (value.trim() === "") {
        io.usage(NULL_SHAPE, [
          error("config_value_required", "test_cmd cannot be empty.", {
            fix: 'specgate config set test_cmd "npm test"',
          }),
        ]);
      }
      const file = writeHarnessTestCmd(projectDir, value);
      io.emit({ config: { [key]: value } }, () =>
        process.stdout.write(
          `  ✔  ${key} = ${value}\n     ${path.relative(process.cwd(), file) || file}\n` +
            "     `check` and `done` now run it.\n"
        )
      );
      process.exit(EXIT.OK);
    }

    const config = read(projectDir);
    config[key] = value;
    const file = write(projectDir, config);

    io.emit({ config }, () =>
      process.stdout.write(
        `  ✔  ${key} = ${value}\n     ${path.relative(process.cwd(), file) || file}\n`
      )
    );
    process.exit(EXIT.OK);
  }
}
