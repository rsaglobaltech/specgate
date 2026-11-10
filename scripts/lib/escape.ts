/**
 * Text a person typed, put where it is read as something else: a regular
 * expression, a Markdown table cell, a shell argument. One place for each
 * escape, so none is hand-written twice and half-done (code scanning:
 * js/incomplete-sanitization, js/regex-injection).
 */

/** `text` matched literally inside a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `text` as one cell of a Markdown table: one line, backslashes then pipes escaped. */
export function markdownCell(text: string): string {
  return String(text).replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * `arg` as one argument of a command line the person copies into their shell:
 * single quotes on POSIX (only `'` needs care), double quotes on Windows with
 * CommandLineToArgvW's rule for backslashes before a quote and at the end.
 */
export function quoteArg(arg: string, platform: string = process.platform): string {
  if (/^[A-Za-z0-9_./:@=,+-]+$/.test(arg)) return arg;
  if (platform !== "win32") return `'${arg.replace(/'/g, "'\\''")}'`;
  let out = '"';
  let slashes = 0;
  for (const ch of arg) {
    if (ch === "\\") {
      slashes++;
      continue;
    }
    if (ch === '"') {
      out += "\\".repeat(slashes * 2 + 1) + '"';
    } else {
      out += "\\".repeat(slashes) + ch;
    }
    slashes = 0;
  }
  return out + "\\".repeat(slashes * 2) + '"';
}
