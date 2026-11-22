/**
 * Write permission for Claude Code in the harness (REQ-264).
 *
 * In print mode Claude Code cannot write a file without permission and there is
 * nobody to grant it: the agent reads the prompt, writes nothing, and the
 * attempt is spent. The drafting commands add `--permission-mode acceptEdits`
 * for that reason (`withWritePermission`); the harness did not, and the
 * command the docs gave for it spent three attempts writing nothing
 * (truck-flote, S50). The harness runs the agent in a throwaway worktree, which
 * is what makes edit permission safe to give.
 *
 * The flag goes right after `claude`, not at the end: the documented command
 * pipes into `specgate harness events`, and a flag appended to the line would
 * be that command's, not Claude's.
 */
export function withAgentPermission(command: string): { command: string; added: boolean } {
  const claude = /^(\s*)claude(?=\s)/.exec(command);
  const isPrint = /(^|\s)(-p|--print)(\s|$)/.test(command);
  const hasOwn =
    /--permission-mode|--allowedTools|--allowed-tools|--dangerously-skip-permissions/.test(command);
  if (!claude || !isPrint || hasOwn) return { command, added: false };
  const at = claude[0].length;
  return {
    command: `${command.slice(0, at)} --permission-mode acceptEdits${command.slice(at)}`,
    added: true,
  };
}

/**
 * Permission to run the project's tests (REQ-614).
 *
 * `acceptEdits` lets Claude Code write files and nothing else: in print mode
 * every shell command is refused, the test command included. The agent wrote a
 * test and its code without running either, said so, and the gate was the
 * first thing to run them — on a Spring service and on a TypeScript project,
 * with the command `harness init` writes. So beside `acceptEdits` the harness
 * allows the gate's own test command, each part of it, and no other command.
 *
 * A command that names its own tools, or skips permissions, is the person's
 * choice and is kept. A part of the test command that a permission rule cannot
 * carry safely inside double quotes is left out rather than rewritten.
 */
export function withTestPermission(
  command: string,
  testCmd: string,
  /** REQ-650: the architecture check, which the gate runs too. */
  archCmd = ""
): { command: string; allowed: string[] } {
  const none = { command, allowed: [] as string[] };
  const claude = /^(\s*)claude(?=\s)/.test(command);
  const isPrint = /(^|\s)(-p|--print)(\s|$)/.test(command);
  const mode = /--permission-mode\s+acceptEdits(?=\s|$)/.exec(command);
  const hasOwn = /--allowedTools|--allowed-tools|--dangerously-skip-permissions/.test(command);
  if (!claude || !isPrint || !mode || hasOwn) return none;
  const allowed = [...new Set([...testCommandParts(testCmd), ...testCommandParts(archCmd)])];
  if (allowed.length === 0) return none;
  const at = mode.index + mode[0].length;
  const rules = allowed.map((part) => `"Bash(${part}:*)"`).join(" ");
  return {
    command: `${command.slice(0, at)} --allowedTools ${rules}${command.slice(at)}`,
    allowed,
  };
}

/** The commands a test command is made of, those a permission rule can name. */
export function testCommandParts(testCmd: string): string[] {
  const parts = String(testCmd || "")
    .split(/&&|\|\||;/)
    .map((part) => part.trim())
    .filter((part) => part && /^[\w@%+=:,./\\ -]+$/.test(part));
  return [...new Set(parts)];
}

/**
 * Claude Code's output streamed into the studio's live view (REQ-278).
 *
 * The command `status` suggests, `claude -p < {prompt_file}`, ran and the live
 * view showed the gate and nothing of the agent: its output reaches /live only
 * as stream-json through `specgate harness events` (truck-flote, S62). A
 * command that already pipes or picks its own output format is the person's
 * choice and is kept as it is.
 */
export function withLiveStream(command: string): string {
  const claude = /^(\s*)claude(?=\s)/.exec(command);
  const isPrint = /(^|\s)(-p|--print)(\s|$)/.test(command);
  if (!claude || !isPrint || command.includes("|") || /--output-format/.test(command))
    return command;
  const at = claude[0].length;
  return (
    `${command.slice(0, at)} --output-format stream-json --verbose${command.slice(at)}`.trimEnd() +
    " | specgate harness events --from claude"
  );
}

/**
 * Claude Code without the person's MCP servers (REQ-650).
 *
 * `claude -p` loads every MCP server of the person's account — mail, design
 * tools, trackers — and their tools enter the context of each call: 345 tools
 * on pintamundo-ai, and a question in the studio's chat took minutes. A
 * drafting, building or asking agent works on the repository and needs none.
 * `--strict-mcp-config` with no `--mcp-config` loads none. A command that names
 * its own MCP configuration is the person's choice and is kept.
 */
export function withoutMcp(command: string): string {
  const claude = /^(\s*)claude(?=\s)/.exec(command);
  const isPrint = /(^|\s)(-p|--print)(\s|$)/.test(command);
  if (!claude || !isPrint || /--mcp-config|--strict-mcp-config/.test(command)) return command;
  const at = claude[0].length;
  return `${command.slice(0, at)} --strict-mcp-config${command.slice(at)}`;
}
