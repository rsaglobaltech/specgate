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
