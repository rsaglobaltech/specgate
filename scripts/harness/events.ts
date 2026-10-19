#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { appendEvent } from "../lib/harness-events";
import {
  EVENTS_ATTEMPT_VAR,
  EVENTS_FILE_VAR,
  EVENTS_REQ_VAR,
  maskCommand,
  shorten,
  stepKind,
  testCounts,
  HarnessEvent,
} from "../../packages/core/src/domain/HarnessEvents";

/**
 * A tool call's input, as Claude Code's stream sends it: an object whose keys
 * depend on the tool (`file_path`, `command`, `old_string`…).
 */
type ToolInput = Record<string, unknown>;

/**
 * One block of a stream message's `content`, as far as this reads it. The
 * fields of a `tool_use` and a `tool_result` are declared as present: those
 * are the only blocks that are read for them, and the stream always sends them.
 */
interface StreamContent {
  type?: string;
  /** `text`: what the model said. */
  text?: string;
  /** `tool_use`: the call's id, tool name and input. */
  id: string;
  name: string;
  input: ToolInput;
  /** `tool_result`: the call it answers, its output and whether it failed. */
  tool_use_id: string;
  content?: unknown;
  is_error?: boolean;
}

/** One line of `--output-format stream-json`, as far as this reads it. */
interface StreamEvent {
  type?: string;
  message?: { content?: StreamContent[] | unknown };
  result?: unknown;
  is_error?: boolean;
  subtype?: string;
}

/**
 * `specgate harness events --from claude` — Claude Code's stream as harness
 * events (ADR-0037).
 *
 * It stands at the end of the agent's pipe:
 *
 *   claude -p --output-format stream-json --verbose < {prompt_file} \
 *     | specgate harness events --from claude
 *
 * Each tool call becomes one `step` line in `AGENT_EVENTS_FILE` when its result
 * arrives, each assistant text one `message` line, and the run's final result
 * text is printed, so the harness still sees what the agent said. Nothing of a
 * tool's output or a file's contents is written: the step keeps its kind, its
 * target and how it ended.
 */

const SOURCES = ["claude"];

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  <agent> | specgate harness events --from claude\n\n" +
      "Reads Claude Code's `--output-format stream-json` on standard input and appends\n" +
      "one line per tool call and per message to the file in AGENT_EVENTS_FILE (set by\n" +
      "`specgate harness run`). Prints the run's final result text. Without the variable\n" +
      "it writes no event and still prints the result.\n"
  );
}

const now = () => Math.floor(Date.now() / 1000);

/** A path with symlinks resolved, also when its last parts do not exist yet. */
function real(p: string): string {
  const rest: string[] = [];
  let cur = p;
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) {
    rest.unshift(path.basename(cur));
    cur = path.dirname(cur);
  }
  try {
    return path.join(fs.realpathSync(cur), ...rest);
  } catch {
    return p;
  }
}

/** Relative to the working directory when inside it; as given otherwise. */
function relative(file: string): string {
  const cwd = real(process.cwd());
  const rel = path.relative(cwd, real(path.resolve(cwd, file)));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel)
    ? rel.split(path.sep).join("/")
    : file;
}

/** The file path or command a tool call worked on. */
function targetOf(input: ToolInput | null | undefined): string {
  const i: ToolInput = input || {};
  const file = i.file_path ?? i.path ?? i.notebook_path;
  if (typeof file === "string") return relative(file);
  if (typeof i.command === "string") return maskCommand(i.command);
  if (typeof i.pattern === "string") return maskCommand(i.pattern);
  if (typeof i.url === "string") return maskCommand(i.url);
  return "";
}

const lines = (s: unknown) => (typeof s === "string" && s !== "" ? s.split("\n").length : 0);

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: { text?: unknown } | null) => (c && typeof c.text === "string" ? c.text : ""))
      .join("\n");
  }
  return "";
}

export async function main(argv: string[]): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }
  const from = argv[argv.indexOf("--from") + 1];
  if (!argv.includes("--from") || !SOURCES.includes(from)) {
    process.stderr.write(`--from expects one of: ${SOURCES.join(", ")}\n`);
    process.exit(2);
  }

  const file = process.env[EVENTS_FILE_VAR] || null;
  const req = process.env[EVENTS_REQ_VAR] || undefined;
  const attempt = Number(process.env[EVENTS_ATTEMPT_VAR]) || undefined;
  const write = (e: HarnessEvent) => appendEvent(file, e, req, attempt);
  const pending = new Map<string, { name: string; input: ToolInput; started: number }>();
  let finalResult = "";
  let failed = false;

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) continue;
    let e: StreamEvent;
    try {
      e = JSON.parse(line);
    } catch {
      continue; // not a stream line: nothing to record
    }
    const content = (e.message && e.message.content) || [];
    if (e.type === "assistant" && Array.isArray(content)) {
      for (const c of content as StreamContent[]) {
        if (c.type === "text" && String(c.text || "").trim()) {
          // Non-empty after trimming, so `text` is there.
          write({ type: "message", text: shorten(c.text!) });
        } else if (c.type === "tool_use") {
          pending.set(c.id, { name: c.name, input: c.input, started: now() });
        }
      }
    } else if (e.type === "user" && Array.isArray(content)) {
      for (const c of content as StreamContent[]) {
        if (c.type !== "tool_result") continue;
        const call = pending.get(c.tool_use_id);
        if (!call) continue;
        pending.delete(c.tool_use_id);
        const given = call.input && call.input.command;
        const command = typeof given === "string" ? given : "";
        const kind = stepKind(call.name, command);
        const extra: Record<string, unknown> =
          kind === "edit"
            ? { added: lines(call.input.new_string), removed: lines(call.input.old_string) }
            : kind === "write"
              ? { added: lines(call.input.content) }
              : kind === "test" || kind === "gate"
                ? testCounts(textOf(c.content))
                : {};
        write({
          type: "step",
          kind,
          tool: call.name,
          target: targetOf(call.input),
          started: call.started,
          ended: now(),
          result: c.is_error ? "error" : "ok",
          ...extra,
        });
      }
    } else if (e.type === "result") {
      finalResult = typeof e.result === "string" ? e.result : "";
      failed = e.is_error === true || Boolean(e.subtype && e.subtype !== "success");
    }
  }
  if (finalResult) process.stdout.write(`${finalResult}\n`);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : err}\n`);
    process.exit(1);
  });
}
