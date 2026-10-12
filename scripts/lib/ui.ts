/**
 * The look of Specgate at a terminal — one palette, one set of symbols, and the
 * few shapes every command is built from.
 *
 * Every command used to carry its own colour table, so `NO_COLOR` was honoured
 * in some and not others, and the same idea — "run this next" — was drawn
 * three ways. Everything a person reads goes through here; `--json` output
 * never does.
 *
 * Rules the shapes keep:
 * - A command a person may copy sits alone on its line, after `➜`, with
 *   nothing to its right but a dim reason, so a triple-click copies it clean.
 * - Colour carries meaning twice at most: a symbol is always there too, so the
 *   output reads the same with `NO_COLOR`, in a log file, or to a screen reader.
 * - Symbols are one column wide. Emoji are not, and they broke every table.
 */

const env = process.env;

/** Colour: on a terminal, unless NO_COLOR or TERM=dumb; FORCE_COLOR wins both ways. */
function colorLevel(): 0 | 1 | 2 | 3 {
  if (env.FORCE_COLOR !== undefined) {
    if (env.FORCE_COLOR === "0" || env.FORCE_COLOR === "false") return 0;
    const n = Number(env.FORCE_COLOR);
    return n >= 1 && n <= 3 ? (n as 1 | 2 | 3) : 1;
  }
  if (env.NO_COLOR !== undefined || env.TERM === "dumb" || !process.stdout.isTTY) return 0;
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return 3;
  if (/256/.test(env.TERM || "") || env.TERM_PROGRAM === "Apple_Terminal") return 2;
  return 1;
}

export const COLOR = colorLevel();

/** Plain symbols where the terminal may not draw Unicode: old Windows consoles, or by request. */
export const ASCII =
  env.SPECGATE_ASCII === "1" ||
  (process.platform === "win32" && !env.WT_SESSION && !env.TERM_PROGRAM);

const esc = (code: string) => (COLOR ? `\x1b[${code}m` : "");

/** One colour, three depths: truecolor, the 256 cube, and the basic 16. */
function tone(rgb: [number, number, number], c256: number, c16: number): string {
  if (!COLOR) return "";
  if (COLOR === 3) return esc(`38;2;${rgb.join(";")}`);
  if (COLOR === 2) return esc(`38;5;${c256}`);
  return esc(String(c16));
}

/**
 * The palette. The names are what the colour means, not what it looks like;
 * `red`/`green`/… stay as aliases for the code that was written against them.
 */
export const c = {
  reset: esc("0"),
  bold: esc("1"),
  dim: esc("2"),
  italic: esc("3"),
  underline: esc("4"),
  brand: tone([167, 139, 250], 141, 35), // violet — the ◆ and the name
  accent: tone([94, 205, 228], 80, 36), // cyan — commands to run
  ok: tone([74, 222, 128], 78, 32), // green
  bad: tone([248, 113, 113], 203, 31), // red
  warn: tone([251, 191, 36], 214, 33), // amber
  note: tone([96, 165, 250], 75, 34), // blue
  muted: tone([148, 163, 184], 247, 90), // slate — secondary text
  red: tone([248, 113, 113], 203, 31),
  green: tone([74, 222, 128], 78, 32),
  yellow: tone([251, 191, 36], 214, 33),
  blue: tone([96, 165, 250], 75, 34),
  magenta: tone([167, 139, 250], 141, 35),
  cyan: tone([94, 205, 228], 80, 36),
  gray: tone([148, 163, 184], 247, 90),
};

export const sym = ASCII
  ? {
      brand: "*",
      ok: "v",
      fail: "x",
      warn: "!",
      info: "i",
      next: ">",
      arrow: "->",
      bullet: "-",
      dot: "*",
      half: "~",
      empty: "o",
      added: "+",
      removed: "-",
      undo: "<",
      line: "-",
      bar: "#",
      barEmpty: ".",
      corner: "`-",
      pipe: "|",
    }
  : {
      brand: "◆",
      ok: "✔",
      fail: "✖",
      warn: "▲",
      info: "ℹ",
      next: "➜",
      arrow: "→",
      bullet: "·",
      dot: "●",
      half: "◐",
      empty: "○",
      added: "+",
      removed: "−",
      undo: "↺",
      line: "─",
      bar: "█",
      barEmpty: "░",
      corner: "└",
      pipe: "│",
    };

/** Text without its colour codes — for measuring and for tests. */
export function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visible width: colour codes take no columns. */
export function width(s: string): number {
  return [...strip(s)].length;
}

export function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - width(s)));
}

const cols = () => Math.min(Math.max(process.stdout.columns || 80, 40), 100);

// ── Shapes ────────────────────────────────────────────────────────────────────
// Each returns a string; the caller writes it, so a shape can go to stdout or
// stderr, or into a test.

/** `◆ specgate · draft catalogo   docs/brief.md` — the first line of a command's output. */
export function header(command: string, context = ""): string {
  return (
    `\n  ${c.brand}${sym.brand}${c.reset} ${c.bold}specgate${c.reset}` +
    `${c.muted} ${sym.bullet} ${c.reset}${c.bold}${command}${c.reset}` +
    (context ? `   ${c.muted}${context}${c.reset}` : "") +
    "\n\n"
  );
}

/** A section title with a rule after it: `Modules ──────────`. */
export function section(title: string): string {
  // Every section ends at the same column, whatever its title.
  const rule = sym.line.repeat(Math.max(4, Math.min(56, cols() - 4) - width(title) - 1));
  return `  ${c.bold}${title}${c.reset} ${c.muted}${rule}${c.reset}\n`;
}

/** A rule across the screen — where Specgate takes over from an agent's output. */
export function rule(): string {
  return `\n  ${c.muted}${sym.line.repeat(cols() - 4)}${c.reset}\n`;
}

export const ok = (msg: string) => `  ${c.ok}${sym.ok}${c.reset}  ${msg}\n`;
export const fail = (msg: string) => `  ${c.bad}${sym.fail}${c.reset}  ${msg}\n`;
export const warn = (msg: string) => `  ${c.warn}${sym.warn}${c.reset}  ${msg}\n`;
export const info = (msg: string) => `  ${c.note}${sym.info}${c.reset}  ${msg}\n`;

/** The way out of a finding, under it: `     fix: …`. */
export const fix = (msg: string) =>
  `     ${c.muted}fix:${c.reset} ${String(msg).split("\n").join("\n          ")}\n`;

/** A command, as it is drawn everywhere: accent colour, nothing else. */
export const cmd = (command: string) => `${c.accent}${command}${c.reset}`;

/** Dim text. */
export const muted = (s: string) => `${c.muted}${s}${c.reset}`;
export const bold = (s: string) => `${c.bold}${s}${c.reset}`;

/** A key and its value, the key padded so a group of them lines up. */
export function kv(key: string, value: string, keyWidth = 12): string {
  return `  ${c.muted}${pad(key, keyWidth)}${c.reset}${value}\n`;
}

/** `████████░░░░░░░░  3 of 8 done` */
export function progress(done: number, total: number, label: string, barWidth = 20): string {
  const filled = total > 0 ? Math.round((done / total) * barWidth) : 0;
  const color = total > 0 && done === total ? c.ok : c.brand;
  return (
    `${color}${sym.bar.repeat(filled)}${c.reset}` +
    `${c.muted}${sym.barEmpty.repeat(barWidth - filled)}${c.reset}  ` +
    `${c.bold}${done}${c.reset} of ${total} ${label}`
  );
}

/** Where something stands, as a symbol: done, in progress, ready, not started. */
export function state(kind: "done" | "ready" | "doing" | "todo" | "blocked"): string {
  switch (kind) {
    case "done":
      return `${c.ok}${sym.ok}${c.reset}`;
    case "ready":
      return `${c.ok}${sym.dot}${c.reset}`;
    case "doing":
      return `${c.warn}${sym.half}${c.reset}`;
    case "blocked":
      return `${c.bad}${sym.empty}${c.reset}`;
    default:
      return `${c.muted}${sym.empty}${c.reset}`;
  }
}

/**
 * The next step — the one thing every command ends with.
 *
 *   Next ───────────────────────
 *   ➜  specgate change archive draft-catalogo
 *      read it with whoever knows the business first
 */
export function next(command: string, why = ""): string {
  return (
    "\n" +
    section("Next") +
    `  ${c.accent}${sym.next}${c.reset}  ${cmd(command)}\n` +
    (why ? `     ${c.muted}${why}${c.reset}\n` : "") +
    "\n"
  );
}

/**
 * Several steps in order. A step that is a command (it starts with
 * `specgate `) is drawn as one, so the eye finds what to type.
 */
export function steps(title: string, items: Array<string | [string, string]>): string {
  let out = "\n" + section(title);
  items.forEach((item, i) => {
    const [text, why] = Array.isArray(item) ? item : [item, ""];
    const n = `${c.muted}${String(i + 1).padStart(2)}${c.reset}`;
    const body = /^specgate\b/.test(text) ? `${c.accent}${sym.next}${c.reset} ${cmd(text)}` : text;
    out += `  ${n}  ${body}${why ? `   ${muted(why)}` : ""}\n`;
  });
  return out + "\n";
}

/** Rows of cells, each column as wide as its widest cell. */
export function table(rows: string[][], indent = 4, gap = 2): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => width(r[i] || ""))));
  return rows
    .map(
      (r) =>
        " ".repeat(indent) +
        r
          .map((cell, i) => (i === r.length - 1 ? cell : pad(cell, widths[i] + gap)))
          .join("")
          .trimEnd() +
        "\n"
    )
    .join("");
}

/** A file the command created (`+`), changed (`~`) or removed (`−`), with what it is for. */
export function fileLine(kind: "added" | "changed" | "removed", file: string, why = ""): string {
  const mark =
    kind === "added"
      ? `${c.ok}${sym.added}${c.reset}`
      : kind === "removed"
        ? `${c.bad}${sym.removed}${c.reset}`
        : `${c.warn}~${c.reset}`;
  return `    ${mark} ${file}${why ? `   ${muted(why)}` : ""}\n`;
}

/**
 * Text to paste somewhere else — into an agent, a file. Indented and coloured,
 * with nothing at the start of the line, so a selection copies it clean.
 */
export function quote(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => `    ${c.accent}${l}${c.reset}`)
      .join("\n") + "\n"
  );
}

/** A file's contents shown for reading, set off by a rule on its left. */
export function block(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => `    ${c.muted}${sym.pipe}${c.reset} ${l}`)
      .join("\n") + "\n"
  );
}

/** `12.3s`, `840ms`, `2m 05s`. */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * A line that says what is running, then is replaced by how it ended.
 *
 * The work it waits on is synchronous (`spawnSync`), so there is no event loop
 * to animate a spinner: on a terminal the line is drawn once and overwritten
 * when the work is done; anywhere else only the outcome is printed, so logs
 * and recordings carry no half-lines.
 */
export function task<T>(
  label: string,
  work: () => T,
  outcome: (result: T) => { ok: boolean; text?: string },
  stream: NodeJS.WriteStream = process.stdout
): T {
  const live = !!stream.isTTY && COLOR > 0;
  const started = Date.now();
  if (live)
    stream.write(`  ${c.brand}${ASCII ? "*" : "◌"}${c.reset}  ${label}${c.muted}…${c.reset}`);
  const result = work();
  const { ok: good, text } = outcome(result);
  // Time only on a terminal: in a log or a recording it would make two runs of
  // the same thing differ.
  const took = live ? ` ${muted(`(${duration(Date.now() - started)})`)}` : "";
  const line = (good ? ok : fail)(`${text || label}${took}`);
  stream.write(live ? `\r\x1b[2K${line}` : line);
  return result;
}

/**
 * One line of the older log style — `logInfo("write spec.md")`,
 * `logInfo("📋 Summary")`, `logInfo("  1. specgate check   # the gate")` — drawn
 * in the shapes above, read from the line's own form. `init`, `adopt` and the
 * pack commands log line by line; this gives them the same look without
 * rewriting each call.
 */
export function logLine(msg: string): string {
  let m: RegExpMatchArray | null;
  if ((m = /^(?:🔍|📋|🗂️|🧭|📦)\s*(.+?):?$/u.exec(msg))) return "\n" + section(m[1]);
  if ((m = /^✅\s*(.+)$/u.exec(msg))) {
    const [head, tail] = m[1].split(/\.\s+(?=Next steps:?$)/);
    return "\n" + ok(bold(head.replace(/\.$/, ""))) + (tail ? "\n" + section("Next steps") : "");
  }
  if ((m = /^\[dry-run\] write (.+)$/.exec(msg))) return fileLine("added", m[1], "dry run");
  if ((m = /^write (.+?)(?: \((.+)\))?$/.exec(msg))) return fileLine("added", m[1], m[2] || "");
  if ((m = /^skip (.+?)(?: \((.+)\))?$/.exec(msg)))
    return `    ${muted(`= ${m[1]}${m[2] ? `   ${m[2]}` : ""}`)}\n`;
  if ((m = /^- (.+?):\s+(.+)$/.exec(msg)))
    return `    ${muted(sym.bullet)} ${muted(m[1] + ":")} ${m[2]}\n`;
  if ((m = /^- (.+)$/.exec(msg))) return `    ${muted(sym.bullet)} ${m[1]}\n`;
  if ((m = /^\s+(\d+)\.\s+(specgate .+?)(?:\s{2,}#\s*(.*))?$/.exec(msg)))
    return `  ${muted(m[1].padStart(2))}  ${c.accent}${sym.next}${c.reset} ${cmd(m[2].trim())}${m[3] ? `   ${muted(m[3])}` : ""}\n`;
  if ((m = /^\s+(\d+)\.\s+(.+)$/.exec(msg))) return `  ${muted(m[1].padStart(2))}  ${m[2]}\n`;
  if ((m = /^\s+(specgate .+?)(?:\s{2,}#\s*(.*))?$/.exec(msg)))
    return `      ${cmd(m[1].trim())}${m[2] ? `   ${muted(m[2])}` : ""}\n`;
  if (/^\s{2,}/.test(msg)) return `     ${msg.trim()}\n`;
  return info(msg);
}
