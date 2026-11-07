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

import { decide as gateDecide, runValidate as realValidate, type GateDiagnostic } from "./gate-hook";
import { decide as guardDecide } from "./guard-hook";
import { isSpecDriven } from "./project-state";
import { sessionContext } from "./session-hook";

/** What the plugin needs from OpenCode's context. */
export interface OpencodeContext {
  directory: string;
  client: {
    session: {
      prompt: (o: { path: { id: string }; body: { parts: { type: "text"; text: string }[] } }) => Promise<unknown>;
    };
  };
}

export interface BridgeDeps {
  env?: Record<string, string | undefined>;
  runValidate?: (cwd: string) => { ok: boolean; diagnostics: GateDiagnostic[] };
}

/** The files an `apply_patch` adds, updates or moves to. */
export function patchFiles(patchText: string): string[] {
  const out: string[] = [];
  for (const m of patchText.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)) {
    out.push(m[1].trim());
  }
  return out;
}

/** The files a tool call writes, or none for a tool that does not write. */
function writtenFiles(tool: string, args: Record<string, unknown>): string[] {
  if ((tool === "write" || tool === "edit") && typeof args.filePath === "string") return [args.filePath];
  if ((tool === "apply_patch" || tool === "patch") && typeof args.patchText === "string") {
    return patchFiles(args.patchText);
  }
  return [];
}

export function createHooks(ctx: OpencodeContext, deps: BridgeDeps = {}) {
  const dir = ctx.directory;
  const env = deps.env ?? process.env;
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

    "tool.execute.before": async (input: { tool: string }, output: { args: Record<string, unknown> }) => {
      for (const file of writtenFiles(input.tool, output.args ?? {})) {
        const d = guardDecide({ cwd: dir, tool_name: "Write", tool_input: { file_path: file } }, env);
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
