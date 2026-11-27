/**
 * A source file with its comments blanked (REQ-800): under `link: strict` a
 * test file names a requirement in its code, its tests' names or its strings —
 * a comment that mentions the id is not a test written for it.
 *
 * Comment syntax is a handful of shapes, where the ways each stack names a
 * test are many: `//` and `/* *\/` for the C family, `#` for Python, Ruby,
 * shell and Elixir, all three for PHP. Strings are stepped over, so
 * `"http://x"` keeps its `//`, and a Python docstring is a string. Each
 * comment character becomes a space and every line break stays, so positions
 * and line numbers are what they were. A file of any other kind is returned
 * as read.
 */

const SLASH =
  /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts|go|java|kt|kts|scala|groovy|cs|fs|swift|rs|c|cc|cpp|h|hpp|php)$/i;
const HASH = /\.(py|rb|sh|ex|exs|php)$/i;
const TRIPLE = /\.py$/i;

export function withoutCodeComments(file: string, source: string): string {
  const slash = SLASH.test(file);
  const hash = HASH.test(file);
  if (!slash && !hash) return source;
  const triple = TRIPLE.test(file);
  const out = source.split("");
  const n = source.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const c = source[i];
    if (triple && (source.startsWith('"""', i) || source.startsWith("'''", i))) {
      const end = source.indexOf(source.slice(i, i + 3), i + 3);
      i = end < 0 ? n : end + 3;
    } else if (c === '"' || c === "'" || (c === "`" && slash)) {
      // A quote left open — a Rust lifetime, a stray apostrophe — ends at the
      // line's end, so it cannot hide the rest of the file.
      let j = i + 1;
      while (j < n && source[j] !== c && (c === "`" || source[j] !== "\n")) {
        j += source[j] === "\\" ? 2 : 1;
      }
      i = j + 1;
    } else if ((slash && c === "/" && source[i + 1] === "/") || (hash && c === "#")) {
      const end = source.indexOf("\n", i);
      const to = end < 0 ? n : end;
      blank(i, to);
      i = to;
    } else if (slash && c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const to = end < 0 ? n : end + 2;
      blank(i, to);
      i = to;
    } else {
      i += 1;
    }
  }
  return out.join("");
}
