/**
 * A check's output read as what it found (REQ-440): `specgate check` and
 * `specgate doctor` write one line per stage or finding — a mark, a name, a
 * detail — and a `fix:` under what failed. Read as text, never as HTML.
 */
export type Mark = "pass" | "fail" | "warn" | "skip";

export interface CliItem {
  mark: Mark;
  name: string;
  detail: string;
  code: string;
  fix: string;
}

const MARKS: Record<string, Mark> = { "✔": "pass", "✖": "fail", "▲": "warn", "·": "skip" };

export function readCliResult(output: string): { items: CliItem[]; summary: string } {
  const items: CliItem[] = [];
  let summary = "";
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const item = /^\s{1,4}([✔✖▲·])\s+(.+)$/.exec(line);
    if (item) {
      let text = item[2];
      let code = "";
      const coded = /^(.*?)\s+\[([a-z0-9_]+)\]$/.exec(text);
      if (coded) {
        text = coded[1];
        code = coded[2];
      }
      const split = /^(.+?)\s{2,}(.*)$/.exec(text);
      items.push({
        mark: MARKS[item[1]],
        name: (split ? split[1] : text).trim(),
        detail: (split ? split[2] : "").trim(),
        code,
        fix: "",
      });
      continue;
    }
    const last = items[items.length - 1];
    const fix = /^\s+fix:\s*(.*)$/.exec(line);
    if (fix && last) {
      last.fix = fix[1].trim();
      continue;
    }
    if (/[█░]/.test(line) || /checks? passed/.test(line)) {
      summary = line.replace(/[█░]/g, "").trim();
      continue;
    }
    // A detail that goes on, indented under its line.
    if (last && /^\s{6,}\S/.test(line) && !last.fix)
      last.detail = `${last.detail} ${line.trim()}`.trim();
  }
  return { items, summary };
}
