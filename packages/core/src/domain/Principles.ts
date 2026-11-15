/**
 * The organization's principles (REQ-330..332): `docs/specs/principles.md`,
 * the version a repository follows, and the principles the gate can check.
 *
 *   ---
 *   principles_version: 1.2.0
 *   source: ../workspace/principles.md      # or pack:<pack_id>
 *   ---
 *   ## P1 — No credentials in code
 *   <!-- specgate:principle forbid="password\s*=" in="src/**" -->
 *
 * Pure: text in, model out. Reading the source and running the checks is the
 * command layer's.
 */

export const PRINCIPLES_FILE = "docs/specs/principles.md";

export interface Principle {
  /** `P1`, or the heading's first word when it has no id. */
  id: string;
  title: string;
  /** A command that passes on exit 0. */
  run?: string;
  /** A pattern no file matched by `in` may contain. */
  forbid?: string;
  in?: string;
  /** `warn`: a failure is advice, not a gate failure. */
  level: "error" | "warn";
}

export interface PrinciplesDoc {
  version: string;
  source: string;
  principles: Principle[];
}

const HEADING = /^#{2,4}\s+(.+?)\s*$/;
const PRINCIPLE_COMMENT = /<!--\s*specgate:principle\b([\s\S]*?)-->/;

/** `key="value with \" escapes"` or `key=value`, as a principle comment writes them. */
function attributes(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][\w-]*)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g;
  for (const m of body.matchAll(re)) {
    out[m[1].toLowerCase()] = m[2] !== undefined ? m[2].replace(/\\"/g, '"') : m[3];
  }
  return out;
}

function frontMatter(text: string): { fields: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fields: {}, body: text };
  const fields: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { fields, body: text.slice(m[0].length) };
}

export function parsePrinciples(text: string): PrinciplesDoc {
  const { fields, body } = frontMatter(text);
  const principles: Principle[] = [];
  let current: Principle | null = null;
  for (const line of body.split(/\r?\n/)) {
    const h = HEADING.exec(line);
    if (h) {
      const [, label] = h;
      const idMatch = /^([A-Z][A-Z0-9-]*\d)\b\s*[—:-]?\s*(.*)$/.exec(label);
      current = {
        id: idMatch ? idMatch[1] : label.split(/\s+/)[0],
        title: idMatch ? idMatch[2] || label : label,
        level: "error",
      };
      principles.push(current);
      continue;
    }
    const c = PRINCIPLE_COMMENT.exec(line);
    if (c && current) {
      const a = attributes(c[1]);
      if (a.run) current.run = a.run;
      if (a.forbid) current.forbid = a.forbid;
      if (a.in) current.in = a.in;
      if (a.level === "warn") current.level = "warn";
    }
  }
  return {
    version: fields.principles_version || "",
    source: fields.source || "",
    // Only a heading with a rule, or one under the title, is a principle.
    principles: principles.filter((p) => p.run || p.forbid || /^[A-Z][A-Z0-9-]*\d$/.test(p.id)),
  };
}

/** -1, 0 or 1, comparing dotted versions numerically (`1.10` after `1.9`). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    String(v || "")
      .replace(/^v/, "")
      .split(/[.-]/)
      .map((p) => (/^\d+$/.test(p) ? Number(p) : 0));
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** A glob (`src/**`, `*.ts`, `apps/*\/src/**`) as a regular expression on `/` paths. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
