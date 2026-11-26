/**
 * A tool's own session, read into one shape (compat-evidence REQ-718): the
 * JSON lines of `claude --output-format stream-json`, `codex exec --json` and
 * `opencode run --format json`. Lines that are not JSON are skipped: a tool
 * that prints prose has an empty session, not a broken one. Pure.
 */

export interface SessionCall {
  /** The tool's own name for what it did: Write, Bash, file_change, mcp:specgate/status… */
  tool: string;
  /** The file written, the command run, or "". */
  target: string;
  /** A file this call wrote, when it says so. */
  wrote: string[];
}

export interface Session {
  calls: SessionCall[];
  /** Calls to an MCP server named specgate, as the tool itself reports them. */
  mcpCalls: number;
  tokensIn: number;
  tokensOut: number;
  /** In US dollars, when the tool states it. */
  cost: number | null;
  /** What the tool's provider refused it with, in its own words (compat-honest REQ-730); null when it did not. */
  providerError: string | null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function lines(text: string): Json[] {
  const out: Json[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      out.push(obj(JSON.parse(t)));
    } catch {
      /* not a JSON line */
    }
  }
  return out;
}

const empty = (): Session => ({
  calls: [],
  mcpCalls: 0,
  tokensIn: 0,
  tokensOut: 0,
  cost: null,
  providerError: null,
});
const words = (v: unknown): string =>
  (typeof v === "string" ? v : str(obj(v).message) || str(obj(v).type)).slice(0, 300);

function claude(events: Json[]): Session {
  const s = empty();
  for (const e of events) {
    if (e.type === "assistant") {
      for (const c of arr(obj(e.message).content)) {
        const part = obj(c);
        if (part.type !== "tool_use") continue;
        const name = str(part.name);
        const input = obj(part.input);
        const file = str(input.file_path) || str(input.notebook_path);
        const wrote = /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(name) && file ? [file] : [];
        s.calls.push({ tool: name, target: file || str(input.command), wrote });
        if (/^mcp__specgate/.test(name)) s.mcpCalls += 1;
      }
    } else if (e.type === "result") {
      const u = obj(e.usage);
      s.tokensIn =
        num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens);
      s.tokensOut = num(u.output_tokens);
      if (typeof e.total_cost_usd === "number") s.cost = e.total_cost_usd;
      if (e.is_error === true)
        s.providerError = words(e.result) || str(e.subtype) || "the tool ended in an error";
    }
  }
  return s;
}

function codex(events: Json[]): Session {
  const s = empty();
  for (const e of events) {
    if (e.type === "item.completed") {
      const item = obj(e.item);
      const kind = str(item.type);
      if (kind === "file_change") {
        const wrote = arr(item.changes)
          .map((c) => str(obj(c).path))
          .filter(Boolean);
        s.calls.push({ tool: "file_change", target: wrote[0] || "", wrote });
      } else if (kind === "command_execution") {
        s.calls.push({ tool: "command", target: str(item.command), wrote: [] });
      } else if (kind === "mcp_tool_call") {
        const server = str(item.server);
        s.calls.push({ tool: `mcp:${server}/${str(item.tool)}`, target: "", wrote: [] });
        if (server === "specgate") s.mcpCalls += 1;
      }
    } else if (e.type === "turn.completed") {
      const u = obj(e.usage);
      s.tokensIn += num(u.input_tokens);
      s.tokensOut += num(u.output_tokens);
    } else if (e.type === "error" || e.type === "turn.failed") {
      s.providerError = words(e.message) || words(e.error) || "the tool ended in an error";
    }
  }
  return s;
}

/** Files an `apply_patch` text touches: its `*** Add|Update File:` lines. */
function patchFiles(text: string): string[] {
  return [...text.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)].map((m) => m[1]!.trim());
}

function opencode(events: Json[]): Session {
  const s = empty();
  let cost = 0;
  let stated = false;
  for (const e of events) {
    const part = obj(e.part);
    if (e.type === "tool_use") {
      const tool = str(part.tool);
      const input = obj(obj(part.state).input);
      const file = str(input.filePath) || str(input.path);
      const wrote =
        /^(write|edit|multiedit)$/.test(tool) && file
          ? [file]
          : /patch/.test(tool)
            ? patchFiles(str(input.patchText))
            : [];
      s.calls.push({ tool, target: file || str(input.command), wrote });
      if (/^specgate[_.]/.test(tool)) s.mcpCalls += 1;
    } else if (e.type === "error") {
      s.providerError = words(e.error) || "the tool ended in an error";
    } else if (e.type === "step_finish") {
      const t = obj(part.tokens);
      s.tokensIn += num(t.input) + num(obj(t.cache).read) + num(obj(t.cache).write);
      s.tokensOut += num(t.output);
      if (typeof part.cost === "number") {
        cost += part.cost;
        stated = true;
      }
    }
  }
  if (stated) s.cost = cost;
  return s;
}

export function sessionOf(tool: "claude" | "codex" | "opencode", output: string): Session {
  const events = lines(output);
  return tool === "claude" ? claude(events) : tool === "codex" ? codex(events) : opencode(events);
}

const isTest = (p: string) =>
  /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
const isSource = (p: string) =>
  /\.[cm]?[jt]sx?$/.test(p) &&
  !isTest(p) &&
  !/(^|\/)(docs|features|node_modules|\.[^/]+)\//.test(p);

/**
 * Was a test written before the first source file? True or false from the
 * session's writes in order; null when it shows neither — a tool that writes
 * through its shell leaves no write to read.
 */
export function testFirst(session: Session, root = ""): boolean | null {
  const rel = (p: string) =>
    root && p.startsWith(root) ? p.slice(root.length).replace(/^\/+/, "") : p;
  const writes = session.calls.flatMap((c) => c.wrote).map(rel);
  const t = writes.findIndex(isTest);
  const s = writes.findIndex(isSource);
  if (t < 0 && s < 0) return null;
  if (s < 0) return true;
  if (t < 0) return false;
  return t < s;
}
