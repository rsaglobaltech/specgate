/**
 * The brief's body, read as cards, and the rules over it. (ADR-0038)
 *
 * A module of the brief is written as Example Mapping writes a story: the
 * rules, the examples that prove them ("the one where…"), and the questions
 * still open. Each card becomes something Specgate already has — a rule a
 * requirement, an example a scenario, a question a `questions.md` row — so
 * the person reviewing a draft reads it against cards they wrote.
 *
 *   ## Module: courses
 *   Rules
 *   - A course holds at most 12 students.
 *   Examples
 *   - The one where Ana joins "Spanish A2", which has 11 students.
 *   Questions
 *   - Can a student be in two courses at once?
 *
 * B2 to B13 are decidable, like the D-rules over a draft: they say what the
 * brief does not say, never whether a rule is right. B1 — the front matter's
 * shapes — lives with the rest of the front matter's checks
 * (`scripts/draft/brief-setup.ts`). Pure: the caller hands the text in.
 */

import type { Diagnostic } from "./Diagnostic";
import { error, info, warning } from "./Diagnostic";
import { actorSurfaces, briefModules, unmeasured } from "./DraftChecklist";
import { withoutComments, withoutQuoted } from "./QuotedText";

export { withoutComments };

export type CardKind = "rules" | "examples" | "questions";

export interface Card {
  readonly text: string;
  /** 1-based, in the whole brief. */
  readonly line: number;
}

export interface ModuleSection {
  /** As the heading writes it, trimmed. */
  readonly name: string;
  readonly line: number;
  /** The section's own text, heading included, as written. */
  readonly source: string;
  /** Text under the heading that is not a card. */
  readonly prose: string;
  readonly rules: readonly Card[];
  readonly examples: readonly Card[];
  readonly questions: readonly Card[];
}

export interface BriefBody {
  /** The body's text: everything after the front matter. */
  readonly text: string;
  readonly modules: readonly ModuleSection[];
}

const FRONT = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const MODULE_HEADING = /^##\s+Module:\s*(.+?)\s*#*\s*$/i;
const CARD_HEADING =
  /^(?:#{3,6}\s+)?\**(rules|examples|questions|reglas|ejemplos|preguntas)\**\s*:?\s*$/i;
const KIND: Record<string, CardKind> = {
  rules: "rules",
  reglas: "rules",
  examples: "examples",
  ejemplos: "examples",
  questions: "questions",
  preguntas: "questions",
};

/** `<your product>`, `<a rule>`: a template's blank, never filled in. */
export function isPlaceholder(text: string): boolean {
  return /^<[^<>]+>[.:]?$/.test(text.trim());
}

/** Whether a line says something: not blank, a heading, a comment or a blank to fill. */
function says(line: string): boolean {
  const t = line.trim().replace(/^[-*]\s+/, "");
  return (
    t.length > 0 &&
    !/^#{1,6}\s/.test(line.trim()) &&
    !isPlaceholder(t) &&
    !CARD_HEADING.test(line.trim())
  );
}

/** The body: its text, and each `## Module:` section with its cards. */
export function readBriefBody(brief: string): BriefBody {
  const src = String(brief || "").replace(/\r\n/g, "\n");
  const fm = FRONT.exec(src);
  const offset = fm ? fm[0].split("\n").length - 1 : 0;
  const text = fm ? src.slice(fm[0].length) : src;
  const lines = withoutComments(text).split("\n");
  const raw = text.split("\n");
  const modules: ModuleSection[] = [];

  let i = 0;
  while (i < lines.length) {
    const head = MODULE_HEADING.exec(lines[i]);
    if (!head) {
      i += 1;
      continue;
    }
    const start = i;
    let end = i + 1;
    while (end < lines.length && !/^##\s/.test(lines[end])) end += 1;
    const cards: Record<CardKind, Card[]> = { rules: [], examples: [], questions: [] };
    const prose: string[] = [];
    let kind: CardKind | null = null;
    let last: { list: Card[]; at: number } | null = null;
    for (let j = start + 1; j < end; j += 1) {
      const line = lines[j];
      const heading = CARD_HEADING.exec(line.trim());
      if (heading) {
        kind = KIND[heading[1].toLowerCase()];
        last = null;
        continue;
      }
      const item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (kind && item) {
        const list = cards[kind];
        list.push({ text: item[1].trim(), line: offset + j + 1 });
        last = { list, at: list.length - 1 };
      } else if (kind && last && /^\s{2,}\S/.test(line)) {
        // A card that wraps onto an indented line is still one card.
        const card = last.list[last.at];
        last.list[last.at] = { ...card, text: `${card.text} ${line.trim()}` };
      } else {
        if (line.trim() === "") last = null;
        else if (!kind) prose.push(line);
        else {
          kind = null;
          last = null;
          prose.push(line);
        }
      }
    }
    const filled = (list: Card[]) => list.filter((c) => !isPlaceholder(c.text));
    modules.push({
      name: head[1].trim(),
      line: offset + start + 1,
      source: raw.slice(start, end).join("\n").trimEnd(),
      prose: prose.join("\n").trim(),
      rules: filled(cards.rules),
      examples: filled(cards.examples),
      questions: filled(cards.questions),
    });
    i = end;
  }
  return { text, modules };
}

/** `Courses`, `live classes` → `courses`, `live-classes`: how `modules:` spells them. */
export function moduleKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The section of the brief for a module of `modules:`, if it has one. */
export function moduleSection(brief: string, module: string): ModuleSection | undefined {
  return readBriefBody(brief).modules.find((m) => moduleKey(m.name) === module);
}

/** `non_goals: [payments, video calls]` → its items, in order. */
export function briefNonGoals(brief: string): string[] {
  const fm = FRONT.exec(String(brief || "").replace(/\r\n/g, "\n"));
  if (!fm) return [];
  const m = /^non_goals:[ \t]*\[([^\]]*)\]/m.exec(fm[0]);
  return m
    ? m[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => s && !isPlaceholder(s))
    : [];
}

/**
 * The values a module's cards state — numbers and double-quoted labels —
 * in the order they appear. A draft that uses these passes D6 by
 * construction: they are the brief's own words.
 */
export function cardValues(section: ModuleSection): string[] {
  const out: string[] = [];
  const add = (v: string) => {
    if (!out.includes(v)) out.push(v);
  };
  for (const c of [...section.rules, ...section.examples]) {
    for (const q of c.text.matchAll(/"([^"\n]+)"|“([^”\n]+)”/g)) add(`"${q[1] ?? q[2]}"`);
    const bare = withoutQuoted(c.text);
    for (const n of bare.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?![\w])/g)) add(n[0]);
  }
  return out;
}

// ── The rules ─────────────────────────────────────────────────────────────────

/**
 * Words a test cannot check. English and Spanish: Specgate's pilots wrote
 * briefs in both. German since tickets (ADR-0039): enterprise boards are
 * often written in it.
 */
export const VAGUE =
  /(?<![\p{L}])(fast|quick(?:ly)?|easy|easily|simple|user[- ]friendly|intuitive(?:ly)?|secure(?:ly)?|robust|flexible|efficient(?:ly)?|appropriate(?:ly)?|adequate(?:ly)?|seamless(?:ly)?|as needed|as soon as possible|as close as possible|nearby|almost|acceptable|asap|etc\.?|and so on|tbd|r[aá]pid[oa]s?|r[aá]pidamente|f[aá]cil(?:es|mente)?|sencill[oa]s?|intuitiv[oa]s?|amigable|robust[oa]s?|eficiente(?:s|mente)?|adecuad[oa]s?|lo antes posible|lo m[aá]s \p{L}+ posible|cerca|casi|aceptables?|etc[eé]tera|por definir|schnell(?:e[nrs]?)?|z[uü]gig|einfach(?:e[nrs]?)?|benutzerfreundlich(?:e[nrs]?)?|intuitiv(?:e[nrs]?)?|flexibel|effizient(?:e[nrs]?)?|angemessen(?:e[nrs]?)?|nahtlos|zeitnah|m[oö]glichst bald|usw\.?)(?![\p{L}])/iu;

/** Frameworks, databases, libraries: how, in a brief about what. */
export const TECHNICAL =
  /\b(postgres(?:ql)?|mysql|mariadb|mongo(?:db)?|redis|sqlite|oracle db|dynamodb|elasticsearch|firebase|supabase|kafka|rabbitmq|react|angular|vue(?:\.js)?|svelte|next\.js|nuxt|django|flask|fastapi|rails|laravel|spring(?: boot)?|express(?:\.js)?|nest(?:js)?|quarkus|flutter|react native|docker|kubernetes|k8s|aws|lambda|s3|azure|gcp|graphql|prisma|hibernate|typeorm)\b/i;

/** A rule's condition, when it opens the sentence — EARS's "When …", "If …, then …". */
const OPENS_WITH_CONDITION =
  /^(when|whenever|if|while|where|once|after|before|unless|during|cuando|si|mientras|salvo|una vez|antes de|despu[eé]s de|durante)\b/i;
/** A condition placed after the obligation: "Joining is refused if the course is full". */
const LATE_CONDITION = /\s(if|when|whenever|unless|while|once|cuando|si|mientras|salvo que)\s/i;

/**
 * "si" and "if" after a verb of saying, checking or deciding mean "whether":
 * "el sistema dice en menos de 1 s si cabe" states no condition (REQ-244).
 */
const WHETHER =
  /\b(dice|dicen|decir|indica|indican|comprueba|comprueban|comprobar|decide|deciden|decidir|sabe|saber|pregunta|preguntar|responde|muestra|calcula|verifica|says|say|tells|tell|checks|check|decides|decide|asks|ask|knows|know|shows|show)\b([^.;:]{0,40}?)\s(si|if)\s/giu;
const withoutWhether = (text: string) =>
  text.replace(WHETHER, (_m, verb: string, between: string) => `${verb}${between} whether `);

/** The author speaking as "I", in English or Spanish (B9, REQ-178). */
const FIRST_PERSON =
  /(?<![\p{L}])(?:I|I'm|I've|my|soy|estoy|quiero|tengo|necesito|uso|yo|mi|mis|me)(?![\p{L}'])/gu;

const MAX_RULES = 7;
/** More modules than this and the brief is a roadmap, not one delivery (REQ-245). */
const MAX_MODULES = 8;

/** What the project can show, when the caller knows: B13 compares the actors' surfaces with it. */
export interface ProjectSurfaces {
  /** false: no mobile app in the project; undefined: not known, nothing compared. */
  mobileApp?: boolean;
}
const MAX_QUESTIONS = 3;

const nameRe = (name: string) =>
  new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu");

/**
 * Rules B2 to B13 over a brief. Errors stop a draft: what it would get wrong.
 * Warnings are for the person: wording a test cannot check.
 */
export function checkBriefBody(brief: string, project: ProjectSurfaces = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const body = readBriefBody(brief);
  const listed = briefModules(brief);

  // B12 — a brief of more than eight modules is several deliveries (REQ-245).
  if (listed.length > MAX_MODULES) {
    out.push(
      warning(
        "B12_too_many_modules",
        `The brief lists ${listed.length} modules; a delivery is three to ${MAX_MODULES}.`,
        {
          fix: "Merge the modules that change together, or move the later phases to a second brief.",
        }
      )
    );
  }

  // B13 — an actor on a surface the project does not have (REQ-245): every
  // draft would owe scenarios nobody can build yet.
  if (project.mobileApp === false) {
    for (const m of brief.matchAll(/\{\s*name:\s*([^,}]+?)\s*,\s*surfaces:\s*\[([^\]]*)\]\s*\}/g)) {
      if (!/\bmobile\b/i.test(m[2])) continue;
      out.push(
        warning(
          "B13_surface_missing",
          `${m[1].trim()} uses mobile, and the project has no mobile app.`,
          {
            target: m[1].trim(),
            fix: "Give the actor the surfaces the project has (web), or add the mobile app before drafting their scenarios.",
          }
        )
      );
    }
  }
  const plain = withoutComments(body.text);

  // B2 — the body says something.
  if (!plain.split("\n").some(says)) {
    out.push(
      error("B2_empty_brief", "The brief below the front matter says nothing yet.", {
        fix: "Write why the product exists and, per module, its rules, examples and questions — or paste your notes as they are.",
      })
    );
    if (body.modules.length === 0) return out;
  }

  // B3 — sections and `modules:` agree, once the brief has sections.
  if (body.modules.length === 0) {
    if (listed.length > 0) {
      out.push(
        info(
          "B3_no_sections",
          "The brief has no `## Module:` sections: each draft reads the whole brief.",
          {
            fix: `Add one per module — \`## Module: ${listed[0]}\` with Rules, Examples and Questions — so each draft reads only its own.`,
          }
        )
      );
    }
  } else {
    // A `<module>` still to name is the front matter's finding, not a mismatch.
    const named = listed.filter((m) => !isPlaceholder(m));
    const sections = body.modules.filter((m) => !isPlaceholder(m.name));
    const keys = sections.map((m) => moduleKey(m.name));
    for (const m of named.filter((x) => !keys.includes(x))) {
      out.push(
        error("B3_no_section", `The module ${m} has no section.`, {
          target: m,
          fix: `Add \`## Module: ${m}\` with its Rules, Examples and Questions.`,
        })
      );
    }
    for (const s of sections.filter((x) => !named.includes(moduleKey(x.name)))) {
      out.push(
        error(
          "B3_unknown_module",
          `The section "Module: ${s.name}" names no module of \`modules:\`.`,
          {
            target: s.name,
            line: s.line,
            fix: `Add ${moduleKey(s.name)} to \`modules:\`, or rename the section to one of ${named.join(", ") || "the listed modules"}.`,
          }
        )
      );
    }
  }

  const actors = [...actorSurfaces(brief).keys()];
  const nonGoals = briefNonGoals(brief);

  for (const s of body.modules) {
    const target = moduleKey(s.name) || s.name;
    const at = { target, line: s.line };
    const cards = s.rules.length + s.examples.length + s.questions.length;

    // B2 — a module section says something.
    if (cards === 0 && !s.prose.split("\n").some(says)) {
      out.push(
        error("B2_empty_module", `The ${target} section is still empty.`, {
          ...at,
          fix: 'Write its Rules (one sentence each), an Example per rule ("The one where…") and any Questions.',
        })
      );
      continue;
    }

    // B4 — rules, and examples that prove them.
    if (s.rules.length === 0) {
      out.push(
        error("B4_no_rule", `The ${target} section has no rule.`, {
          ...at,
          fix: 'Under "Rules", one line per thing that must hold: "A course holds at most 12 students."',
        })
      );
    } else if (s.examples.length === 0) {
      out.push(
        error("B4_no_example", `The ${target} section has rules and no example.`, {
          ...at,
          fix: 'Under "Examples", at least one per rule, with its values: "The one where Ana joins a course with 11 students."',
        })
      );
    }

    // B8 — small enough to review.
    if (s.rules.length > MAX_RULES || s.questions.length > MAX_QUESTIONS) {
      out.push(
        warning(
          "B8_too_big",
          `The ${target} section has ${s.rules.length} rules and ${s.questions.length} questions.`,
          {
            ...at,
            fix: `Split it into two modules — at most ${MAX_RULES} rules and ${MAX_QUESTIONS} open questions each — or answer some questions first.`,
          }
        )
      );
    }

    for (const r of s.rules) {
      const where = { target, line: r.line };
      const bare = withoutQuoted(r.text);
      const vague = VAGUE.exec(bare);
      if (vague) {
        out.push(
          warning("B5_vague", `"${r.text}" says "${vague[1]}", which no test can check.`, {
            ...where,
            fix: 'Say what it means in values: "in under 2 seconds", "with one tap", or move it to Questions.',
          })
        );
      }
      if (unmeasured(bare)) {
        out.push(
          warning("B6_unmeasured", `"${r.text}" promises a quantity and states no number.`, {
            ...where,
            fix: 'Give the number and its unit: "within 2 seconds", "for 500 students at once".',
          })
        );
      }
      const tech = TECHNICAL.exec(bare);
      if (tech) {
        out.push(
          warning("B7_technical", `"${r.text}" names ${tech[1]}: how, not what.`, {
            ...where,
            fix: "Say what the business needs; the stack is chosen in the design, not the brief.",
          })
        );
      }
      if (
        !OPENS_WITH_CONDITION.test(bare.trim()) &&
        LATE_CONDITION.test(` ${withoutWhether(bare)} `)
      ) {
        out.push(
          warning("B11_condition_last", `"${r.text}" puts its condition after what must happen.`, {
            ...where,
            fix: 'Open with the condition (EARS): "When the course is full, joining is refused."',
          })
        );
      }
    }

    // B10 — what the product will not do stays out.
    for (const c of [...s.rules, ...s.examples]) {
      const goal = nonGoals.find((g) => nameRe(g).test(c.text));
      if (goal) {
        out.push(
          warning("B10_non_goal", `"${c.text}" names ${goal}, which non_goals rules out.`, {
            target,
            line: c.line,
            fix: `Take it out, or take ${goal} off \`non_goals\` if it is in scope after all.`,
          })
        );
      }
    }
  }

  // B9 — every declared actor appears in the brief. A brief its one actor
  // wrote in the first person ("Soy…, quiero…") names them on every line, as
  // "I": warning about it sent its author to rewrite their own words (REQ-178).
  const declared = actors.filter((x) => !isPlaceholder(x));
  const firstPerson = (plain.match(FIRST_PERSON) || []).length >= 2;
  for (const a of declared) {
    if (declared.length === 1 && firstPerson) break;
    if (!nameRe(a).test(plain)) {
      out.push(
        warning(
          "B9_actor_unnamed",
          `The actor ${a} is declared and the brief never mentions them.`,
          {
            target: a,
            fix: firstPerson
              ? "The brief is in the first person: say once which actor its author is, and what the others do — or take them off `actors:`."
              : "Say in a rule or an example what they do — or take them off `actors:`.",
          }
        )
      );
    }
  }
  return out;
}
