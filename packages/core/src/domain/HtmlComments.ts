/**
 * HTML comments out of Markdown, without a regular expression.
 *
 * `/<!--[\s\S]*?-->/g` reads fine and is what CodeQL reports as incomplete
 * multi-character sanitization: a crafted `<!<!---->--` leaves a comment
 * opener behind, and the lazy match is polynomial on many `<!--`. Scanning
 * with indexOf removes every comment, and an unterminated one to the end of
 * the text, and repeats until nothing changes, so no comment opener survives.
 */

export interface WithoutCommentsOptions {
  /**
   * Also drop the spaces and tabs around each comment and the one newline
   * after it — a comment alone on its line leaves no blank line.
   */
  wholeLine?: boolean;
}

export function withoutHtmlComments(text: string, opts: WithoutCommentsOptions = {}): string {
  // Removing a comment can join what was around it into a new opener
  // (`<!<!---->--`): repeat until nothing changes.
  let current = text;
  for (;;) {
    const next = removeOnce(current, opts);
    if (next === current) return next;
    current = next;
  }
}

function removeOnce(text: string, opts: WithoutCommentsOptions): string {
  let out = "";
  let at = 0;
  for (;;) {
    const open = text.indexOf("<!--", at);
    if (open === -1) return out + text.slice(at);
    let before = text.slice(at, open);
    if (opts.wholeLine) before = before.replace(/[ \t]+$/, "");
    out += before;
    const close = text.indexOf("-->", open + 4);
    if (close === -1) return out;
    at = close + 3;
    if (opts.wholeLine) {
      while (text[at] === " " || text[at] === "\t") at++;
      if (text[at] === "\n") at++;
    }
  }
}

/** `s` without any of `chars` at its end; a loop, not `/[…]+$/`, which is polynomial. */
export function trimEndChars(s: string, chars: string): string {
  let end = s.length;
  while (end > 0 && chars.includes(s[end - 1])) end--;
  return s.slice(0, end);
}
