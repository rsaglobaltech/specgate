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

import type { Diagnostic } from "./Diagnostic";
import { error, info, warning } from "./Diagnostic";
import { TECHNICAL, VAGUE } from "./BriefCards";
import { withoutQuoted } from "./QuotedText";

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
/** A criterion's first word: on its own line, it starts a criterion even without a marker. */
const OPENS_CRITERION =
  /^\s*(?:\*\*)?(?:given|gegeben sei|angenommen|dado|dada|scenario|szenario|escenario)\b/i;

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
  attrs?: { level?: number; text?: string; url?: string; shortName?: string; timestamp?: string };
  content?: AdfNode[];
}

function inline(node: AdfNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  // Inline nodes that carry their text in attrs: "@Ana", a smart link, an emoji.
  if (node.type === "mention") return node.attrs?.text ?? "";
  if (node.type === "emoji") return node.attrs?.text ?? node.attrs?.shortName ?? "";
  if (node.type === "inlineCard") return node.attrs?.url ?? "";
  if (node.type === "date") {
    const ms = Number(node.attrs?.timestamp);
    return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
  }
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

/**
 * A section's lines as items. A list marker starts an item; so does a line of
 * text after a blank line, at the start, or opening with "Given" (or its
 * German and Spanish words). A line right below an item
 * continues it (a wrapped line, a nested list). No text is dropped: a
 * criterion written as a paragraph between list items is still a criterion.
 */
function items(lines: string[]): string[] {
  const out: string[] = [];
  let current: string | null = null;
  const flush = () => {
    if (current !== null && current.trim()) out.push(current.trim());
    current = null;
  };
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (m && !/^\s{3,}/.test(line)) {
      flush();
      current = m[1].trim();
    } else if (!line.trim()) {
      flush();
    } else if (current === null) {
      current = line.trim();
    } else if (OPENS_CRITERION.test(line)) {
      flush();
      current = line.trim();
    } else {
      current += " " + (m ? m[1] : line).trim();
    }
  }
  flush();
  return out;
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

// ── The Definition of Ready: T1 to T9 ────────────────────────────────────────

const MAX_CRITERIA = 8;

/** A criterion that tells the developer which tests to write, not what the system does. */
const TEST_INSTRUCTION =
  /\b(?:unit|integration|e2e|end-to-end|regression|automated)[- ]?tests?\b|\btests?\s+(?:run|cover|pass)|\bpruebas\s+(?:unitarias|de integraci[oó]n)|\b(?:unit|integrations?)-?tests?\b|\btestf[aä]lle\b/i;

/**
 * A quantity promised without a number. Narrower than the draft's D-rule: a
 * ticket says "when the dashboard loads" and "the action is not available"
 * about behaviour, and any digit in a criterion is taken as its measure.
 */
const QUANTITY =
  /\b(?:fast|faster|quick(?:ly)?|slow|speed|latency|response time|performan(?:t|ce)|throughput|concurren(?:t|cy)|scalab(?:le|ility)|uptime|real[- ]time|instant(?:ly)?|r[aá]pid[oa]?|veloz|escalable|schnell|performant|echtzeit)\b/i;
const unmeasured = (text: string) =>
  QUANTITY.test(text.replace(/\b\p{L}+-\p{L}+/gu, "")) && !/\d/.test(text);

/** What a deliverable's criteria speak of: work handed over, not behaviour. */
const DELIVERABLE =
  /\b(?:delivered|documented|reviewed|approve[sd]?|signed off|figma|figjam|miro|wirefram\w*|mockups?|prototypes?|design system|style ?guide|geliefert|dokumentiert|abgenommen|entregad[oa]s?|documentad[oa]s?|revisad[oa]s?|aprobad[oa]s?)\b/i;

const isEpic = (type: string) => /^epic$|^épica$/i.test(type.trim());
const isSubtask = (type: string) => /^sub-?task$|^unteraufgabe$|^subtarea$/i.test(type.trim());

/**
 * Rules T1 to T9 over a ticket. Errors keep a change from opening: a draft
 * from this ticket would be wrong. Warnings are for the analyst and the
 * reviewer. Every fix is written for whoever edits the ticket in Jira.
 */
export function checkTicket(t: Ticket): Diagnostic[] {
  const out: Diagnostic[] = [];
  const target = t.key || "ticket";

  if (isEpic(t.type)) {
    return [
      error(
        "ticket_epic",
        `${target} is an epic: it maps to a capability and is not drafted itself.`,
        {
          target,
          fix: `Map it in alm.config.yaml (epics: { ${target}: <capability> }) and draft its stories one by one.`,
        }
      ),
    ];
  }

  if (isSubtask(t.type) && !t.parent) {
    out.push(
      error("T8_orphan_subtask", `${target} is a sub-task with no parent story.`, {
        target,
        fix: "Attach it to its story in Jira; a sub-task is drafted as part of its story's change.",
      })
    );
  }

  if (t.criteria.length === 0) {
    out.push(
      error("T1_no_criteria", `${target} has no acceptance criteria.`, {
        target,
        fix:
          'In the description, add a line "Acceptance Criteria" and under it one item per ' +
          'criterion: "Given …, when …, then …".',
      })
    );
  }

  t.criteria.forEach((criterion, i) => {
    const n = i + 1;
    const where = { target: `${target} criterion ${n}` };
    const bare = withoutQuoted(criterion);
    // "quick-action buttons" names a thing; "easy-to-use" is still vague.
    const vague = [...bare.matchAll(new RegExp(VAGUE.source, "giu"))]
      .filter((m) => {
        const after = bare.slice(m.index! + m[0].length);
        return !/^-\p{L}/u.test(after) || /^-to-/i.test(after);
      })
      .map((m) => `"${m[1]}"`);
    if (vague.length) {
      out.push(
        error(
          "T2_vague",
          `Criterion ${n} says ${[...new Set(vague)].join(" and ")}, which no test can check.`,
          {
            ...where,
            fix: 'Say what it means in values: "within 2 seconds", "in at most 3 clicks".',
          }
        )
      );
    }
    if (unmeasured(bare)) {
      out.push(
        warning("T3_unmeasured", `Criterion ${n} promises a quantity and states no number.`, {
          ...where,
          fix: 'Give the number and its unit: "responds within 2 seconds for 1,000 entries a day".',
        })
      );
    }
    const tech = TECHNICAL.exec(bare);
    if (tech) {
      out.push(
        warning("T4_technical", `Criterion ${n} names ${tech[1]}: how, not what.`, {
          ...where,
          fix: "Say what the user or the business sees; the technology is the team's decision.",
        })
      );
    }
    if (TEST_INSTRUCTION.test(bare)) {
      out.push(
        warning("T6_test_instruction", `Criterion ${n} prescribes tests instead of behaviour.`, {
          ...where,
          fix: 'Write each case it lists as a criterion of its own ("Given a stay of 1 hour 1 minute, then …"); the tests follow from those.',
        })
      );
    }
  });

  if (t.criteria.length > MAX_CRITERIA) {
    out.push(
      warning("T5_too_big", `${target} has ${t.criteria.length} criteria.`, {
        target,
        fix: `Split the story: at most ${MAX_CRITERIA} criteria each, so one change stays reviewable.`,
      })
    );
  }

  if (t.criteria.length > 0 && t.criteria.every((c) => DELIVERABLE.test(c))) {
    out.push(
      warning(
        "T7_not_behaviour",
        `${target}'s criteria speak of deliverables, not of what the system does.`,
        {
          target,
          fix: "A deliverable is tracked on the board, not specified: leave it out of the spec, or add criteria for what the system does.",
        }
      )
    );
  }

  for (const q of t.questions) {
    if (!q.assumption) {
      out.push(
        info("T9_open_question", `"${q.text}" has no stated assumption.`, {
          target,
          fix: 'Add "Assumption: …" after the question, so the draft can proceed and the reviewer sees what was assumed.',
        })
      );
    }
  }
  return out;
}

/** Ready when no T-rule is an error. */
export function ticketReady(findings: readonly Diagnostic[]): boolean {
  return !findings.some((d) => d.severity === "error");
}
