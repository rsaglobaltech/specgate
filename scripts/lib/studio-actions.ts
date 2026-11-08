/**
 * The commands the studio runs for its sections (REQ-438): a fixed list of
 * actions, each naming the `specgate` command it runs and the arguments it
 * takes, every argument checked before anything runs. Nothing outside the list
 * runs, whatever the page sends — the token says the page is the studio's, not
 * that what it asks is safe.
 *
 * One action runs at a time, in the project folder, as a job of its own; its
 * output goes to the git-ignored events folder, where the page reads it as it
 * grows, and its exit code is kept beside it.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { listChangeIds } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { studioLog } from "./harness-events";
import { findCliRoot } from "./project-root";

const cli = () => path.join(findCliRoot(__dirname), "bin", "specgate.js");

type Args = Record<string, unknown>;
type Check = (value: unknown, projectDir: string) => string | null;

/** A change that exists: its id, never a path. */
const change: Check = (v, dir) =>
  typeof v === "string" && /^[a-z0-9][a-z0-9._-]{0,99}$/.test(v) && !v.includes("..")
    ? listChangeIds(dir).includes(v)
      ? null
      : `there is no open change ${v}`
    : "a change is named by its id";

/** A new change's id: lowercase words joined by hyphens, not one that exists. */
const newChange: Check = (v, dir) =>
  typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(v)
    ? listChangeIds(dir).includes(v)
      ? `the change ${v} exists already`
      : null
    : "a new change's id is lowercase words joined by hyphens";

const req: Check = (v) =>
  typeof v === "string" && /^REQ-\d{1,6}$/.test(v) ? null : "a requirement is named REQ-NNN";

const ticket: Check = (v) =>
  typeof v === "string" && /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/.test(v)
    ? null
    : "a ticket is named like KAN-13";

/** Whether a string holds a control character: a newline, a NUL, an escape. */
const hasControl = (v: string) =>
  [...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/** One line of text, without a control character: what a preference or an idea holds. */
const text =
  (max: number): Check =>
  (v) =>
    typeof v === "string" && v.trim() && v.length <= max && !hasControl(v)
      ? null
      : `a line of at most ${max} characters`;

/** The preferences `specgate config set` takes, and the values a closed one accepts. */
export const CONFIG_KEYS: Record<string, string[] | null> = {
  profile: ["core", "full"],
  language: null,
  pet: ["on", "off"],
  agent_guard: ["on", "off"],
  test_cmd: null,
  arch_cmd: null,
  agent: null,
};

const configKey: Check = (v) =>
  typeof v === "string" && v in CONFIG_KEYS ? null : "a preference specgate config knows";

interface Action {
  args: Record<string, Check>;
  /** Arguments it may go without. */
  optional?: string[];
  argv: (a: Record<string, string>) => string[];
  /** It reads the project from the folder it runs in: `check`, `init` and `agents install` take no --project-dir. */
  inFolder?: boolean;
  /** A further check across the arguments. */
  check?: (a: Record<string, string>) => string | null;
}

const ACTIONS: Record<string, Action> = {
  "change-list": { args: {}, argv: () => ["change", "list"] },
  "change-show": { args: { change }, argv: (a) => ["change", "show", a.change] },
  "change-validate": { args: { change }, argv: (a) => ["change", "validate", a.change] },
  "archive-preview": { args: { change }, argv: (a) => ["archive", a.change, "--dry-run"] },
  archive: { args: { change }, argv: (a) => ["archive", a.change] },
  "propose-idea": { args: { change: newChange }, argv: (a) => ["propose", a.change] },
  "propose-ticket": { args: { ticket }, argv: (a) => ["propose", "--from-ticket", a.ticket] },
  check: { args: {}, argv: () => ["check"], inFolder: true },
  doctor: { args: {}, argv: () => ["doctor"] },
  apply: { args: { req }, argv: (a) => ["apply", a.req] },
  "config-list": { args: {}, argv: () => ["config", "list"] },
  "config-set": {
    args: { key: configKey, value: text(400) },
    argv: (a) => ["config", "set", a.key, a.value],
    check: (a) => {
      const allowed = CONFIG_KEYS[a.key];
      if (allowed && !allowed.includes(a.value)) return `${a.key} takes ${allowed.join(" or ")}`;
      if (a.key === "agent" && !a.value.includes("{prompt_file}"))
        return "the agent command names {prompt_file}";
      return null;
    },
  },
  "agents-install": { args: {}, argv: () => ["agents", "install"], inFolder: true },
  "agents-init": { args: {}, argv: () => ["agents", "init"] },
  "adopt-preview": { args: {}, argv: () => ["init", "--dry-run", "--yes"], inFolder: true },
  adopt: { args: {}, argv: () => ["init", "--yes"], inFolder: true },
  "alm-status": { args: {}, argv: () => ["alm", "status"] },
  "alm-sync-preview": { args: {}, argv: () => ["alm", "sync", "--dry-run"] },
  "alm-sync": { args: {}, argv: () => ["alm", "sync"] },
};

/** The names of the actions the studio offers. */
export const ACTION_NAMES = Object.keys(ACTIONS);

export type Planned =
  | { ok: true; argv: string[]; inFolder?: boolean }
  | { ok: false; code: "action_unknown" | "argument_invalid"; message: string };

/** The command an action would run, every argument checked — or why it is refused. */
export function planAction(projectDir: string, name: string, args: Args = {}): Planned {
  const action = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : undefined;
  if (!action) {
    return { ok: false, code: "action_unknown", message: `The studio does not run "${name}".` };
  }
  const given = Object.keys(args || {});
  const extra = given.filter((k) => !(k in action.args));
  if (extra.length) {
    return {
      ok: false,
      code: "argument_invalid",
      message: `${name} takes no ${extra.join(", ")}.`,
    };
  }
  const values: Record<string, string> = {};
  for (const [key, check] of Object.entries(action.args)) {
    const v = args[key];
    if (v === undefined && action.optional?.includes(key)) continue;
    const why = check(v, projectDir);
    if (why) return { ok: false, code: "argument_invalid", message: `${name}: ${key} — ${why}.` };
    values[key] = String(v);
  }
  const why = action.check?.(values);
  if (why) return { ok: false, code: "argument_invalid", message: `${name}: ${why}.` };
  return action.inFolder
    ? { ok: true, argv: action.argv(values), inFolder: true }
    : { ok: true, argv: action.argv(values) };
}

export interface ActionRun {
  action: string;
  argv: string[];
  pid: number;
  started: number;
  /** Its exit code once it ended; null while it runs, or when the studio did not see it end. */
  exit: number | null;
}

const RECORD = "studio-action.json";
const recordFile = (projectDir: string) =>
  path.join(path.dirname(studioLog(projectDir, "action")), RECORD);

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readRecord(projectDir: string): ActionRun | null {
  try {
    return JSON.parse(fs.readFileSync(recordFile(projectDir), "utf8")) as ActionRun;
  } catch {
    return null;
  }
}

/** The output kept, its last 64 KB: enough for any command the list runs. */
function output(projectDir: string): string {
  try {
    const text = fs.readFileSync(studioLog(projectDir, "action"), "utf8");
    return text.length > 65536 ? text.slice(-65536) : text;
  } catch {
    return "";
  }
}

/** What runs now, what ran last and its output. */
export function actionView(projectDir: string): {
  running: ActionRun | null;
  last: ActionRun | null;
  output: string;
} {
  const last = readRecord(projectDir);
  const running = last && last.exit === null && alive(last.pid) ? last : null;
  return { running, last, output: last ? output(projectDir) : "" };
}

export type Started = { ok: true; run: ActionRun } | { ok: false; code: string; message: string };

/** Run an action as a job: checked, one at a time, its output kept as it grows. */
export function runAction(projectDir: string, name: string, args: Args = {}): Started {
  const planned = planAction(projectDir, name, args);
  if (!planned.ok) return planned;
  const busy = actionView(projectDir).running;
  if (busy) {
    return {
      ok: false,
      code: "action_running",
      message: `specgate ${busy.argv.join(" ")} is still running. Wait for it to end.`,
    };
  }
  const log = studioLog(projectDir, "action");
  fs.writeFileSync(log, `$ specgate ${planned.argv.join(" ")}\n`, "utf8");
  const out = fs.openSync(log, "a");
  // Arguments go as an array, never through a shell: a value is a value.
  const child = spawn(
    process.execPath,
    [cli(), ...planned.argv, ...(planned.inFolder ? [] : ["--project-dir", projectDir])],
    {
      cwd: projectDir,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    }
  );
  fs.closeSync(out);
  const run: ActionRun = {
    action: name,
    argv: planned.argv,
    pid: child.pid || 0,
    started: Math.floor(Date.now() / 1000),
    exit: null,
  };
  fs.writeFileSync(recordFile(projectDir), JSON.stringify(run), "utf8");
  child.on("exit", (code, signal) => {
    const now = readRecord(projectDir);
    if (!now || now.pid !== run.pid) return;
    fs.writeFileSync(
      recordFile(projectDir),
      JSON.stringify({ ...now, exit: code ?? (signal ? 128 : 1) }),
      "utf8"
    );
  });
  child.on("error", () => undefined);
  child.unref();
  return { ok: true, run };
}
