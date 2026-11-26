/**
 * The agent guards for OpenCode (REQ-422): the same three Claude Code gets
 * from its hooks, through OpenCode's plugin hooks.
 *
 * - `experimental.chat.system.transform` — the session hears the open change
 *   and what comes next (REQ-420).
 * - `tool.execute.before` — a write to source code waits for a test that names
 *   the requirement; throwing refuses the tool call (REQ-421).
 * - `session.idle` — the gate; when it is red, its findings go back to the
 *   session once per user message, as the `Stop` hook blocks once per prompt.
 *
 * The plugin file OpenCode loads is a thin ES module that requires this one,
 * so the logic is the same compiled code the Claude Code hooks run.
 */

import {
  decide as gateDecide,
  runValidate as realValidate,
  type GateDiagnostic,
} from "./gate-hook";
import { decide as guardDecide } from "./guard-hook";
import { guardOff, hookLog, isSpecDriven, patchFiles } from "./project-state";

export { patchFiles };
import { sessionContext } from "./session-hook";

/** What the plugin needs from OpenCode's context. */
export interface OpencodeContext {
  directory: string;
  client: {
    session: {
      prompt: (o: {
        path: { id: string };
        body: { parts: { type: "text"; text: string }[] };
      }) => Promise<unknown>;
    };
  };
}

export interface BridgeDeps {
  env?: Record<string, string | undefined>;
  runValidate?: (cwd: string) => { ok: boolean; diagnostics: GateDiagnostic[] };
}

/** The files a tool call writes, or none for a tool that does not write. OpenCode 2 names the file `path`, OpenCode 1 `filePath`. */
function writtenFiles(tool: string, args: Record<string, unknown>): string[] {
  const file = typeof args.path === "string" ? args.path : args.filePath;
  if ((tool === "write" || tool === "edit" || tool === "multiedit") && typeof file === "string")
    return [file];
  if ((tool === "apply_patch" || tool === "patch") && typeof args.patchText === "string") {
    return patchFiles(args.patchText);
  }
  return [];
}

/**
 * outside-judge REQ-746: the guard as it was when the session started. A
 * session that began with it on keeps it on, whatever its project's config
 * comes to say; the next session reads the switch again.
 */
function heldGuard(
  dir: string,
  env: Record<string, string | undefined>
): Record<string, string | undefined> {
  return guardOff(dir, env) ? env : { ...env, SPECGATE_GUARD: "on" };
}

/** What the call writes, where its tool says: for the acts that are a person's (REQ-746). */
function writtenText(args: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [from, to] of [
    ["content", "content"],
    ["newString", "new_string"],
    ["new_string", "new_string"],
    ["patchText", "patchText"],
  ]) {
    if (typeof args[from] === "string") out[to] = args[from] as string;
  }
  return out;
}

/** OpenCode's shell tool: `shell` in 2, `bash` in 1. Judged by the working tree (REQ-742), and by what it asks for (REQ-746). */
function guardShell(
  tool: string,
  args: Record<string, unknown>,
  dir: string,
  env: Record<string, string | undefined>
): void {
  if (tool !== "shell" && tool !== "bash") return;
  const command = typeof args.command === "string" ? { command: args.command } : {};
  const d = guardDecide({ cwd: dir, tool_name: "Bash", tool_input: command }, env);
  if (d.allow) return;
  hookLog({ hook: "guard", decision: "refused", file: d.file ?? "", reason: d.message }, env);
  throw new Error(d.message);
}

export function createHooks(ctx: OpencodeContext, deps: BridgeDeps = {}) {
  const dir = ctx.directory;
  const env = heldGuard(dir, deps.env ?? process.env);
  const runValidate = deps.runValidate ?? realValidate;
  /** The last user message of each session: the gate speaks once per message. */
  const lastMessage = new Map<string, string>();
  const told = new Set<string>();
  let count = 0;

  return {
    "experimental.chat.system.transform": async (_input: unknown, output: { system: string[] }) => {
      const text = sessionContext(dir);
      if (text) output.system.push(text);
    },

    "tool.execute.before": async (
      input: { tool: string },
      output: { args: Record<string, unknown> }
    ) => {
      guardShell(input.tool, output.args ?? {}, dir, env);
      for (const file of writtenFiles(input.tool, output.args ?? {})) {
        const d = guardDecide(
          {
            cwd: dir,
            tool_name: "Write",
            tool_input: { file_path: file, ...writtenText(output.args ?? {}) },
          },
          env
        );
        hookLog(
          {
            hook: "guard",
            decision: d.allow ? "allowed" : "refused",
            file,
            ...(d.allow ? {} : { reason: d.message }),
          },
          env
        );
        if (!d.allow) throw new Error(d.message);
      }
    },

    "chat.message": async (input: { sessionID: string; messageID?: string }) => {
      lastMessage.set(input.sessionID, input.messageID ?? `#${++count}`);
    },

    event: async ({ event }: { event: { type: string; properties?: { sessionID?: string } } }) => {
      try {
        if (event.type !== "session.idle" || !isSpecDriven(dir)) return;
        const id = event.properties?.sessionID;
        if (!id) return;
        const key = `${id}:${lastMessage.get(id) ?? ""}`;
        const decision = gateDecide({ cwd: dir, prompt_id: key }, runValidate, (k) => {
          if (told.has(k)) return true;
          told.add(k);
          return false;
        });
        hookLog(
          {
            hook: "gate",
            decision: decision.block ? "blocked" : decision.message ? "told" : "passed",
            ...(decision.message ? { reason: decision.message } : {}),
          },
          env
        );
        if (decision.block) {
          await ctx.client.session.prompt({
            path: { id },
            body: { parts: [{ type: "text", text: decision.message }] },
          });
        }
      } catch {
        // The gate never breaks a session.
      }
    },
  };
}

/** What the plugin needs from OpenCode 2's context (REQ-728): measured against 2.3.2. */
export interface OpencodeV2Context {
  location: { directory: string };
  session: {
    hook(
      name: "context",
      fn: (event: { system: { type: "text"; text: string }[] }) => void | Promise<void>
    ): Promise<unknown>;
    hook(
      name: "prompt",
      fn: (event: { sessionID: string; messageID?: string }) => void | Promise<void>
    ): Promise<unknown>;
    prompt(o: { sessionID: string; text: string }): Promise<unknown>;
  };
  tool: {
    hook(
      name: "execute.before",
      fn: (event: { tool: string; input?: Record<string, unknown> }) => void | Promise<void>
    ): Promise<unknown>;
  };
  event: {
    subscribe(o: {
      signal: AbortSignal;
    }): AsyncIterable<{ type: string; data?: { sessionID?: string } }>;
  };
}

/**
 * The same three guards on OpenCode 2's hooks (REQ-728): `context` for what the
 * session hears, `execute.before` on a tool for the test before the code, and
 * the event `session.execution.succeeded` — the agent stopped — for the gate,
 * whose findings go back into the session once per message of the Developer's.
 * Returns what OpenCode calls when it unloads the plugin.
 */
export async function setupV2(ctx: OpencodeV2Context, deps: BridgeDeps = {}): Promise<() => void> {
  const dir = ctx.location.directory;
  const env = heldGuard(dir, deps.env ?? process.env);
  const runValidate = deps.runValidate ?? realValidate;
  const lastMessage = new Map<string, string>();
  const told = new Set<string>();
  let count = 0;

  await ctx.session.hook("context", (event) => {
    const text = sessionContext(dir);
    if (text) event.system.push({ type: "text", text });
  });

  await ctx.tool.hook("execute.before", (event) => {
    guardShell(event.tool, event.input ?? {}, dir, env);
    for (const file of writtenFiles(event.tool, event.input ?? {})) {
      const d = guardDecide(
        {
          cwd: dir,
          tool_name: "Write",
          tool_input: { file_path: file, ...writtenText(event.input ?? {}) },
        },
        env
      );
      hookLog(
        {
          hook: "guard",
          decision: d.allow ? "allowed" : "refused",
          file,
          ...(d.allow ? {} : { reason: d.message }),
        },
        env
      );
      if (!d.allow) throw new Error(d.message);
    }
  });

  await ctx.session.hook("prompt", (event) => {
    lastMessage.set(event.sessionID, event.messageID ?? `#${++count}`);
  });

  /** The gate for a session whose agent stopped; its findings sent once per message. */
  const stopped = async (id: string): Promise<void> => {
    try {
      if (!isSpecDriven(dir)) return;
      const key = `${id}:${lastMessage.get(id) ?? ""}`;
      const decision = gateDecide({ cwd: dir, prompt_id: key }, runValidate, (k) => {
        if (told.has(k)) return true;
        told.add(k);
        return false;
      });
      hookLog(
        {
          hook: "gate",
          decision: decision.block ? "blocked" : decision.message ? "told" : "passed",
          ...(decision.message ? { reason: decision.message } : {}),
        },
        env
      );
      if (decision.block) await ctx.session.prompt({ sessionID: id, text: decision.message });
    } catch {
      // The gate never breaks a session.
    }
  };

  const controller = new AbortController();
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (event.type === "session.execution.succeeded" && event.data?.sessionID)
          await stopped(event.data.sessionID);
      }
    } catch {
      // The stream ends when the plugin unloads.
    }
  })();
  return () => controller.abort();
}
