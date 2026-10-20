/**
 * A Jira ticket, read as source text. (ADR-0039)
 *
 * An analyst writes a story the way the KAN board shows it:
 *
 *   As an administrator, I want … so that …
 *   Source: Spec §2.1
 *   Acceptance Criteria
 *   1. Given …, when …, then …
 *   Open questions
 *   - Is … ? Assumption: …
 *
 * The headings are paragraphs in bold more often than headings, and come in
 * the team's language, so a section starts at any line that *is* one of the
 * known names — a heading, a bold paragraph, a line with a colon. The rest of
 * the ticket is kept as written: `ticket.md` is the text a draft is checked
 * against, and a reader that rewrites it would be checking against itself.
 *
 * Pure: the issue JSON in, the parts out. Reading Jira is the provider's job.
 */

export interface TicketQuestion {
  readonly text: string;
  /** What the analyst assumed meanwhile — "Assumption: …" — or null. */
  readonly assumption: string | null;
}

export interface Ticket {
  readonly key: string;
  readonly summary: string;
  /** Story, Bug, Task, Sub-task… as the board names it. */
  readonly type: string;
  /** The epic, or the story of a sub-task. */
  readonly parent: string | null;
  readonly labels: readonly string[];
  readonly url: string | null;
  /** The text before the first section: the "As a … I want …" part. */
  readonly intent: string;
  /** "Source: …", where the analyst says the story comes from. */
  readonly source: string | null;
  readonly criteria: readonly string[];
  readonly questions: readonly TicketQuestion[];
  /** The description as plain markdown, every line kept. */
  readonly description: string;
}

/** Where criteria come from, when the board keeps them in a field of their own. */
export interface ReadTicketOptions {
  readonly acceptanceField?: string;
  /** The site, for the ticket's link. */
  readonly baseUrl?: string;
}

const CRITERIA_HEADINGS = [
  "acceptance criteria",
  "acceptance criterion",
  "akzeptanzkriterien",
  "akzeptanzkriterium",
  "criterios de aceptación",
  "criterios de aceptacion",
];
const QUESTION_HEADINGS = ["open questions", "offene fragen", "preguntas abiertas"];

const SOURCE_LINE = /^\s*(?:\*\*)?(?:source|quelle|fuente)\s*:\s*(?:\*\*)?\s*(.+)$/i;
const ASSUMPTION = /\s*(?:assumption|annahme|supuesto)\s*:\s*/i;
const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

type Section = "intent" | "criteria" | "questions" | "other";

/** `**Acceptance Criteria:**`, `## Akzeptanzkriterien`, `Open questions` → the bare name. */
function headingName(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .replace(/:\s*$/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim()
    .toLowerCase();
}

function sectionOf(line: string): Section | null {
  const name = headingName(line);
  if (CRITERIA_HEADINGS.includes(name)) return "criteria";
  if (QUESTION_HEADINGS.includes(name)) return "questions";
  // Another heading ends the section it interrupts.
  if (/^#{1,6}\s+\S/.test(line.trim())) return "other";
  return null;
}

// ── Atlassian Document Format → markdown ──────────────────────────────────────

interface AdfNode {
  type?: string;
  text?: string;
  attrs?: { level?: number };
  content?: AdfNode[];
}

function inline(node: AdfNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inline).join("");
}

function blocks(nodes: AdfNode[] | undefined, indent = ""): string[] {
  const out: string[] = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "paragraph":
        out.push(
          ...inline(node)
            .split("\n")
            .map((l) => indent + l)
        );
        break;
      case "heading":
        out.push(`${"#".repeat(node.attrs?.level ?? 2)} ${inline(node)}`);
        break;
      case "bulletList":
      case "orderedList":
        (node.content ?? []).forEach((item, i) => {
          const marker = node.type === "orderedList" ? `${i + 1}. ` : "- ";
          const [first, ...rest] = blocks(item.content, indent + "   ");
          out.push(indent + marker + (first ?? "").trimStart(), ...rest);
        });
        break;
      case "codeBlock":
        out.push("```", inline(node), "```");
        break;
      case "rule":
        out.push("---");
        break;
      case "table":
        for (const row of node.content ?? []) {
          out.push(
            "| " +
              (row.content ?? []).map((cell) => blocks(cell.content).join(" ")).join(" | ") +
              " |"
          );
        }
        break;
      default:
        if (node.content) out.push(...blocks(node.content, indent));
        else if (node.text) out.push(indent + node.text);
    }
    if (!indent) out.push("");
  }
  return out;
}

/** An ADF document, or a plain string, as markdown. */
export function documentText(value: unknown): string {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n").trim();
  if (!value || typeof value !== "object") return "";
  return blocks((value as AdfNode).content)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── The parts ─────────────────────────────────────────────────────────────────

/** A section's lines as items: list items, or else its non-empty paragraphs. */
function items(lines: string[]): string[] {
  const listed: string[] = [];
  let current: string | null = null;
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (m && !/^\s{3,}/.test(line)) {
      if (current !== null) listed.push(current);
      current = m[1].trim();
    } else if (current !== null && line.trim()) {
      current += " " + line.trim();
    } else if (current !== null) {
      listed.push(current);
      current = null;
    }
  }
  if (current !== null) listed.push(current);
  if (listed.length) return listed;
  return lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function question(text: string): TicketQuestion {
  const parts = text.split(ASSUMPTION);
  if (parts.length < 2) return { text, assumption: null };
  return { text: parts[0].trim(), assumption: parts.slice(1).join(" ").trim() || null };
}

interface JiraIssueJson {
  key?: unknown;
  fields?: Record<string, unknown> & {
    summary?: unknown;
    issuetype?: { name?: unknown };
    parent?: { key?: unknown } | null;
    labels?: unknown;
    description?: unknown;
  };
}

/** Read one issue — Jira's JSON for it — into its parts. */
export function readTicket(issue: unknown, opts: ReadTicketOptions = {}): Ticket {
  const json = (issue ?? {}) as JiraIssueJson;
  const fields = json.fields ?? {};
  const key = String(json.key ?? "");
  const description = documentText(fields.description);

  const sections: Record<Section, string[]> = {
    intent: [],
    criteria: [],
    questions: [],
    other: [],
  };
  let source: string | null = null;
  let current: Section = "intent";
  for (const line of description.split("\n")) {
    const next = sectionOf(line);
    if (next) {
      current = next;
      continue;
    }
    const src = current === "intent" ? SOURCE_LINE.exec(line) : null;
    if (src && source === null) {
      source = src[1].trim();
      continue;
    }
    sections[current].push(line);
  }

  const field = opts.acceptanceField ? documentText(fields[opts.acceptanceField]) : "";
  const criteria = field ? items(field.split("\n")) : items(sections.criteria);

  return {
    key,
    summary: String(fields.summary ?? ""),
    type: String(fields.issuetype?.name ?? ""),
    parent: fields.parent?.key ? String(fields.parent.key) : null,
    labels: Array.isArray(fields.labels) ? fields.labels.map(String) : [],
    url: opts.baseUrl && key ? `${opts.baseUrl.replace(/\/$/, "")}/browse/${key}` : null,
    intent: sections.intent
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    source,
    criteria,
    questions: items(sections.questions).map(question),
    description,
  };
}
