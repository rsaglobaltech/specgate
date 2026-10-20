/**
 * Text a rule over prose must not read as structure (ADR-0036).
 *
 * A code span is literal: `agentkit verify <module>` names a command, it is not
 * an unfilled placeholder. A fenced block is an example, not a declaration.
 * Rules that scan free text strip these first, so a specification never has
 * to be worded around the tool.
 */

/** The text with every `code span` blanked. */
export function withoutCodeSpans(text: string): string {
  return String(text || "").replace(/`[^`\n]*`/g, " ");
}

/** The text with code spans and "double-quoted strings" blanked. */
export function withoutQuoted(text: string): string {
  return withoutCodeSpans(text).replace(/"[^"\n]*"|“[^”\n]*”/g, " ");
}

/** Markdown with every fenced block (``` or ~~~) blanked, line count kept. */
export function withoutFences(markdown: string): string {
  let fenced = false;
  return String(markdown || "")
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

/** The text with every HTML comment blanked, its line breaks kept. */
export function withoutComments(text: string): string {
  return String(text || "").replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ""));
}
