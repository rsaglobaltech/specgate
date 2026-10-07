/**
 * The lite YAML reader the CLI uses for `pack.yaml`, `harness.config.yaml` and
 * the project config.
 *
 * Deliberately not a full YAML implementation: it covers the mapping, sequence
 * and scalar forms those files are allowed to use, and nothing else. Pure —
 * text in, plain object out — so it belongs to the domain rather than to any
 * one command that happens to read a file.
 */

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(0, i).trimEnd();
      }
    }
  }

  return line;
}

function splitKeyValue(text) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === ":" && !inSingle && !inDouble) {
      return {
        key: text.slice(0, i).trim(),
        value: text.slice(i + 1).trim(),
      };
    }
  }

  return null;
}

/**
 * Split a flow sequence on the commas that separate items, not the ones inside
 * a quoted item.
 *
 * A plain `split(",")` turned `["Invoice line items, totals, status, aging"]`
 * into four items, the first `"Invoice line items` and the last `aging"`. The
 * curated packs write exactly that shape, so a pack declaring one
 * responsibility shipped as declaring four, and the stray quote characters rode
 * along into the generated documents.
 *
 * `splitKeyValue` above already tracks quotes for the same reason; this is that
 * scan, applied where it was missing.
 */
function splitFlowItems(inner: string): string[] {
  const items: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "," && !inSingle && !inDouble) {
      items.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  items.push(inner.slice(start));
  return items;
}

function parseScalar(raw) {
  const text = raw.trim();

  // Quoted scalars, with the escapes YAML defines for each: `''` inside single
  // quotes is one quote (`'the device''s fix'`), and `\"` inside double quotes.
  if (text.length > 1 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  // Inline flow sequences: `aggregates: [Invoice, Payment]`. Ordinary YAML, and
  // what a pack author writes for a short list — the curated packs are full of
  // them, and without this they parsed as the literal string "[Invoice]" and
  // then failed cross-reference checks against an aggregate nobody declared.
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1).trim();
    if (inner === "") return [];
    return splitFlowItems(inner).map((part) => parseScalar(part.trim()));
  }

  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  return text;
}

/** A line that starts a mapping entry: a key, then `:` and a space or the end. */
function isKeyLine(text: string): boolean {
  return /^(?:"[^"]*"|'[^']*'|[^\s'"#-][^:]*?):(?:\s|$)/.test(text);
}

function parseTokens(tokens) {
  let index = 0;

  /**
   * A scalar written over several lines — what YAML emitters produce for a
   * long description. A quoted one runs to its closing quote; a plain one takes
   * every deeper line that is neither a key nor a list item. Lines are joined
   * with a space, as YAML folds them. Both used to stop the parse with
   * "Unexpected YAML token", so a pack written by a YAML library would not load.
   */
  function continueScalar(raw: string, indent: number): string {
    let text = raw;
    const quote = text[0] === '"' || text[0] === "'" ? text[0] : "";
    const closed = () => text.length > 1 && text.endsWith(quote);
    if (quote) {
      while (!closed() && index < tokens.length) {
        text += " " + tokens[index].text;
        index += 1;
      }
      return text;
    }
    while (
      index < tokens.length &&
      tokens[index].indent > indent &&
      !tokens[index].text.startsWith("- ") &&
      !isKeyLine(tokens[index].text)
    ) {
      text += " " + tokens[index].text;
      index += 1;
    }
    return text;
  }

  function parseNode(indent) {
    if (index >= tokens.length) return null;
    if (tokens[index].indent < indent) return null;

    if (tokens[index].indent === indent && tokens[index].text.startsWith("- ")) {
      return parseList(indent);
    }

    return parseObject(indent);
  }

  function parseObject(indent) {
    const obj = {};

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.indent !== indent) break;
      if (token.text.startsWith("- ")) break;

      const pair = splitKeyValue(token.text);
      if (!pair || !pair.key) {
        throw new Error(`Invalid YAML object entry on line ${token.line}: ${token.text}`);
      }

      index += 1;

      if (pair.value === "") {
        if (index < tokens.length && tokens[index].indent > indent) {
          obj[pair.key] = parseNode(tokens[index].indent);
        } else if (
          index < tokens.length &&
          tokens[index].indent === indent &&
          tokens[index].text.startsWith("- ")
        ) {
          // An indentless sequence: `key:` then `- item` at the key's own
          // indent. Valid YAML, and the default of PyYAML and most editors.
          obj[pair.key] = parseList(indent);
        } else {
          obj[pair.key] = {};
        }
      } else {
        obj[pair.key] = parseScalar(continueScalar(pair.value, indent));
      }
    }

    return obj;
  }

  function parseList(indent) {
    const arr = [];

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.indent !== indent || !token.text.startsWith("- ")) break;

      const itemText = token.text.slice(2).trim();
      index += 1;

      if (itemText === "") {
        if (index < tokens.length && tokens[index].indent > indent) {
          arr.push(parseNode(tokens[index].indent));
        } else {
          arr.push(null);
        }
        continue;
      }

      const inlinePair = isKeyLine(itemText) ? splitKeyValue(itemText) : null;
      if (!inlinePair) {
        arr.push(parseScalar(continueScalar(itemText, indent)));
        continue;
      }

      const obj = {};
      if (inlinePair.value === "") {
        if (index < tokens.length && tokens[index].indent > indent) {
          obj[inlinePair.key] = parseNode(tokens[index].indent);
        } else {
          obj[inlinePair.key] = {};
        }
      } else {
        obj[inlinePair.key] = parseScalar(continueScalar(inlinePair.value, indent + 2));
      }

      if (
        index < tokens.length &&
        tokens[index].indent > indent &&
        !tokens[index].text.startsWith("- ")
      ) {
        const childIndent = tokens[index].indent;
        const extra = parseObject(childIndent);
        Object.assign(obj, extra);
      }

      arr.push(obj);
    }

    return arr;
  }

  const firstIndent = tokens.length > 0 ? tokens[0].indent : 0;
  const root = parseNode(firstIndent) || {};

  if (index < tokens.length) {
    const token = tokens[index];
    throw new Error(`Unexpected YAML token on line ${token.line}: ${token.text}`);
  }

  return root;
}

/**
 * A parsed YAML document. `unknown` rather than `any` on purpose: every caller
 * knows the shape it expects and says so, instead of the parser pretending to
 * know shapes it cannot.
 */
export type YamlDocument = Record<string, unknown>;

/**
 * The parts of a `pack.yaml` the CLI reads.
 *
 * Deliberately partial and open: `schemas/pack.schema.json` is the authority
 * on the full format (ADR-0020), and a duplicate of it here would be a second
 * description to keep in step. What this type buys is that the six fields the
 * code actually touches stop being `unknown`.
 */
export interface PackModel extends YamlDocument {
  metadata?: { name?: string; [key: string]: unknown };
  requirements?: unknown[];
  scenarios?: unknown[];
  use_cases?: unknown[];
  commands?: unknown[];
  events?: unknown[];
}

export function parseYamlLite(content: string): YamlDocument {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const tokens = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const withoutComment = stripInlineComment(line);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^\s*/)[0].length;
    tokens.push({
      indent,
      text: withoutComment.trim(),
      line: i + 1,
    });
  }

  if (tokens.length === 0) return {};
  return parseTokens(tokens);
}
