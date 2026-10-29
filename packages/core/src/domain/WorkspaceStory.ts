/**
 * A workspace story as text: the stories a workspace brief names, the
 * sections of a `story.md`, and the names a workspace gives its repositories
 * (REQ-339..348). Pure; reading and writing the files is `scripts/lib`.
 */

export interface BriefStory {
  id: string;
  title: string;
  repos: string[];
}

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** The YAML between a brief's leading `---` lines, or null. */
export function briefFrontMatter(text: string): string | null {
  const m = FRONT.exec(text);
  return m ? m[1] : null;
}

/** Everything after the front matter. */
export function briefText(text: string): string {
  const m = FRONT.exec(text);
  return (m ? text.slice(m[0].length) : text).replace(/^(?:[ \t]*\r?\n)+/, "");
}

/** `a, b, [c, d]` split on the commas outside brackets. */
function topLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

/**
 * The stories of a workspace brief's front matter (REQ-339):
 *
 *     stories:
 *       - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }
 */
export function briefStories(frontMatter: string | null): BriefStory[] {
  if (!frontMatter) return [];
  const lines = frontMatter.split(/\r?\n/);
  const start = lines.findIndex((l) => /^stories:/.test(l));
  if (start < 0) return [];
  const out: BriefStory[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = /^\s*-\s*\{(.*)\}\s*$/.exec(line);
    if (!m) continue;
    const fields: Record<string, string> = {};
    for (const part of topLevel(m[1])) {
      const kv = /^([a-z_]+)\s*:\s*(.*)$/.exec(part);
      if (kv) fields[kv[1]] = kv[2].trim();
    }
    const id = unquote(fields.id || "");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) continue;
    const repos = /^\[(.*)\]$/.exec(fields.repos || "");
    out.push({
      id,
      title: unquote(fields.title || "") || id.replace(/-/g, " "),
      repos: repos
        ? repos[1]
            .split(",")
            .map((r) => unquote(r))
            .filter(Boolean)
        : [],
    });
  }
  return out;
}

/** The front matter `workspace draft` writes above a client's brief. */
export function workspaceBriefTemplate(product: string, repos: string[]): string {
  return [
    "---",
    `product: ${product}`,
    "# The business stories of the brief, each split across the repositories it",
    "# touches: `specgate workspace draft <id>` drafts one, `workspace propose <id>`",
    "# opens its change in each repository (REQ-339).",
    `# e.g.  - { id: follow-shipment, title: The client follows a shipment, repos: [${repos.slice(0, 2).join(", ")}] }`,
    "stories: []",
    "---",
    "",
  ].join("\n");
}

/** A `##` section of a Markdown text, without its comments, or "". */
export function section(md: string, heading: RegExp): string {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (at < 0) return "";
  const body: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (/^##\s/.test(l)) break;
    body.push(l);
  }
  return body
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

export const INTENT = /intent|intenci[oó]n|context/i;
export const CRITERIA = /acceptance criteria|criterios de aceptaci[oó]n|akzeptanzkriterien/i;

/** A story's (or a Discover's) `AC-n` lines, as written. */
export function criteriaLines(md: string): string[] {
  return section(md, CRITERIA)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s*AC-\d+\s*[:—–-]\s*\S/.test(l))
    .map((l) => l.replace(/^[-*]\s*/, "").replace(/\s+/g, " "));
}

/** The `story.md` `workspace draft <id>` writes for a person, or an agent, to fill. */
export function storyTemplate(title: string, repos: string[]): string {
  return [
    `# Story: ${title}`,
    "",
    "## Intent",
    "",
    "<!-- The business story, in the words of whoever asked for it: who needs what, and why. It stays as it is while each repository's change works out the how. -->",
    "",
    "## Acceptance criteria",
    "",
    "<!-- One line each, numbered: every repository's design answers the ones it touches. -->",
    "- AC-1:",
    "",
    "## Repositories",
    "",
    ...repos.map((r) => `- \`${r}\``),
    "",
  ].join("\n");
}

/**
 * The names a workspace gives sibling folders: without the prefix they all
 * share (`truck-flote-fleet`, `truck-flote-web` → `fleet`, `web`), so ids read
 * `fleet:REQ-012` (REQ-348). Unchanged when stripping would leave a name empty
 * or two names equal.
 */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  let prefix = names[0];
  for (const n of names.slice(1)) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const cut = prefix.lastIndexOf("-");
  if (cut < 0) return names;
  const keep = prefix.slice(0, cut + 1);
  const short = names.map((n) => n.slice(keep.length));
  const valid = short.every((s) => /^[a-z][a-z0-9-]*$/.test(s));
  return valid && new Set(short).size === short.length ? short : names;
}
