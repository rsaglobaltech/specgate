/**
 * Setting one value in a YAML file the CLI owns, line by line (REQ-507, REQ-508).
 *
 * `config set` writes `.harness/profiles.yaml`, the `checks:` of
 * `harness.config.yaml` and `alm.config.yaml`, files people also edit by hand:
 * re-serialising a parsed document would drop their comments and reorder their
 * keys. So the line that holds the key is replaced, or the key is added at the
 * end of the block it belongs to, and every other line is kept as it was —
 * line endings included. Pure: text in, text out. Only the block forms the lite
 * reader reads (`key:` mappings, `- name:` items) are edited.
 */

/** A scalar as YAML text: numbers and booleans bare, every string quoted. */
export function yamlScalar(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) return `[${value.map((v) => yamlScalar(v)).join(", ")}]`;
  if (typeof value !== "string") return String(value);
  return /["\\]/.test(value) ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
}

interface Lines {
  lines: string[];
  eol: string;
}

function split(text: string): Lines {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { lines, eol };
}

const join = ({ lines, eol }: Lines) => (lines.length ? lines.join(eol) + eol : "");
const indentOf = (line: string) => line.length - line.trimStart().length;
/** A line that says something: not blank, not a comment. */
const content = (line: string) => line.trim() !== "" && !line.trim().startsWith("#");
const keyRe = (key: string) => new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\s|$)`);

/** Where the block of the line at `at` (indent `indent`) ends: the next line as shallow. */
function blockEnd(lines: string[], at: number, indent: number, to: number): number {
  for (let i = at + 1; i < to; i += 1) {
    if (content(lines[i]) && indentOf(lines[i]) <= indent) return i;
  }
  return to;
}

/** After the last line that says something in [from, to), or `from` when none does. */
function insertAt(lines: string[], from: number, to: number): number {
  for (let i = to - 1; i >= from; i -= 1) if (content(lines[i])) return i + 1;
  return from;
}

function setIn(
  lines: string[],
  from: number,
  to: number,
  parentIndent: number,
  path: string[],
  value: string
): void {
  const first = lines.slice(from, to).find((l) => content(l) && indentOf(l) > parentIndent);
  const indent = parentIndent < 0 ? 0 : first ? indentOf(first) : parentIndent + 2;
  const pad = " ".repeat(indent);
  const [key, ...rest] = path;
  let at = -1;
  for (let i = from; i < to; i += 1) {
    if (content(lines[i]) && indentOf(lines[i]) === indent && keyRe(key).test(lines[i].trim())) {
      at = i;
      break;
    }
  }
  if (rest.length === 0) {
    const line = `${pad}${key}: ${value}`;
    if (at >= 0) lines[at] = line;
    else lines.splice(insertAt(lines, from, to), 0, line);
    return;
  }
  if (at < 0) {
    at = insertAt(lines, from, to);
    lines.splice(at, 0, `${pad}${key}:`);
    to += 1;
  } else if (lines[at].trim() !== `${key}:`) {
    // `profiles: {}` and the like: an empty mapping written inline.
    lines[at] = `${pad}${key}:`;
  }
  setIn(lines, at + 1, blockEnd(lines, at, indent, to), indent, rest, value);
}

/** `text` with `path` (mapping keys, outermost first) set to the YAML `value`. */
export function setYamlValue(text: string, path: string[], value: string): string {
  const doc = split(text);
  setIn(doc.lines, 0, doc.lines.length, -1, path, value);
  return join(doc);
}

/** The `- name: <name>` item of a top-level list, as line numbers; null when absent. */
function findItem(
  lines: string[],
  from: number,
  to: number,
  name: string
): { at: number; end: number; indent: number } | null {
  for (let i = from; i < to; i += 1) {
    const t = lines[i].trim();
    if (!content(lines[i]) || !t.startsWith("-")) continue;
    const indent = indentOf(lines[i]);
    const end = blockEnd(lines, i, indent, to);
    const named = lines.slice(i, end).some((l, k) => {
      const field = (k === 0 ? l.trim().replace(/^-\s*/, "") : l.trim()).match(/^name:\s*(.*)$/);
      return field && field[1].trim().replace(/^["']|["']$/g, "") === name;
    });
    if (named) return { at: i, end, indent };
  }
  return null;
}

/**
 * `text` with the field of the item named `name` in the top-level list
 * `listKey` set to the YAML `value`; the item is added, named, when absent.
 */
export function setYamlListItem(
  text: string,
  listKey: string,
  name: string,
  field: string,
  value: string
): string {
  const doc = split(text);
  const { lines } = doc;
  let at = lines.findIndex((l) => indentOf(l) === 0 && keyRe(listKey).test(l.trim()));
  if (at < 0) {
    at = insertAt(lines, 0, lines.length);
    lines.splice(at, 0, `${listKey}:`);
  } else if (lines[at].trim() !== `${listKey}:`) {
    lines[at] = `${listKey}:`; // `checks: []`
  }
  const end = blockEnd(lines, at, 0, lines.length);
  const item = findItem(lines, at + 1, end, name);
  if (!item) {
    const first = lines.slice(at + 1, end).find((l) => content(l) && l.trim().startsWith("-"));
    const pad = " ".repeat(first ? indentOf(first) : 2);
    const where = insertAt(lines, at + 1, end);
    const added = [`${pad}- name: ${yamlScalar(name)}`];
    if (field !== "name") added.push(`${pad}  ${field}: ${value}`);
    lines.splice(where, 0, ...added);
    return join(doc);
  }
  const fieldPad = " ".repeat(item.indent + 2);
  for (let i = item.at; i < item.end; i += 1) {
    const isFirst = i === item.at;
    const body = isFirst ? lines[i].trim().replace(/^-\s*/, "") : lines[i].trim();
    if (!content(lines[i]) || (!isFirst && indentOf(lines[i]) !== item.indent + 2)) continue;
    if (keyRe(field).test(body)) {
      lines[i] = isFirst
        ? `${" ".repeat(item.indent)}- ${field}: ${value}`
        : `${fieldPad}${field}: ${value}`;
      return join(doc);
    }
  }
  lines.splice(insertAt(lines, item.at, item.end), 0, `${fieldPad}${field}: ${value}`);
  return join(doc);
}
