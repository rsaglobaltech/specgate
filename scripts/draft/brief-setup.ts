/**
 * The brief's front matter: what it is for, how to write it, and what is
 * wrong with one.
 *
 * `specgate draft` needs four facts the brief rarely states in a form a tool
 * can read: the product, where people use it, who uses it where, and the
 * pieces to draft one at a time. The user who tried the first version did
 * not know who was meant to write them, or how (#95). So this module holds
 * everything `draft` tells a person about them — the explanation, the
 * template, the guide an agent follows to propose them — and checks a front
 * matter in plain words, each problem with its fix.
 *
 * The parsing is the checklist's own (`actorSurfaces`, `briefModules`), so a
 * front matter this module accepts is one the checklist can read.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { actorSurfaces, briefModules } from "../../packages/core/src/domain/DraftChecklist";

/** The places D3 knows how to check: an HTTP call, or a screen. */
export const SURFACES = ["api", "web", "mobile", "desktop"] as const;

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** The YAML between the leading `---` lines, or null. */
export function frontMatter(brief: string): string | null {
  const m = FRONT.exec(brief);
  return m ? m[1] : null;
}

/** Everything after the front matter, without the blank lines that follow it. */
export function briefBody(brief: string): string {
  const m = FRONT.exec(brief);
  return (m ? brief.slice(m[0].length) : brief).replace(/^(?:[ \t]*\r?\n)+/, "");
}

const uncomment = (fm: string) =>
  fm
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

function field(fm: string, name: string): string | null {
  const m = new RegExp(`^${name}:[ \\t]*(.*)$`, "m").exec(uncomment(fm));
  return m ? m[1].trim() : null;
}

function list(value: string | null): string[] {
  const m = /^\[([^\]]*)\]/.exec(value || "");
  return m
    ? m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

export interface BriefProblem {
  code: string;
  message: string;
  fix: string;
  /** The front matter field a `brief_wrong_shape` is about. */
  field?: string;
}

/** The items under `name:` written as a YAML block list (`  - web`). */
function blockItems(fm: string, name: string): string[] {
  const m = new RegExp(`^${name}:[ \\t]*\\n((?:[ \\t]+-[^\\n]*\\n?)+)`, "m").exec(uncomment(fm));
  return m
    ? m[1]
        .split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean)
    : [];
}

/**
 * B1 — a field Specgate cannot read because of how it is written, not
 * because it is missing. `actors: [Admin]` was reported as "There is no
 * `actors:` list" and `surfaces: web` passed silently (ADR-0038).
 */
function wrongShapes(fm: string): BriefProblem[] {
  const out: BriefProblem[] = [];
  const asList = (items: string[]) => `[${items.join(", ")}]`;
  const surfacesValue = field(fm, "surfaces") ?? "";
  const productSurfaces = surfacesValue.startsWith("[")
    ? list(surfacesValue)
    : surfacesValue
      ? surfacesValue.split(/[,\s]+/).filter(Boolean)
      : blockItems(fm, "surfaces");
  const oneSurface = productSurfaces.find((x) => !placeholder(x)) || "web";

  for (const name of ["surfaces", "modules", "non_goals"]) {
    const value = field(fm, name);
    if (value === null) continue;
    // `modules:` may be a YAML block list; the checklist reads both.
    if (name === "modules" && value === "") continue;
    const items =
      value === ""
        ? blockItems(fm, name)
        : value.startsWith("[")
          ? null
          : value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
    if (items === null || items.length === 0) continue;
    out.push({
      code: "brief_wrong_shape",
      field: name,
      message: `\`${name}:\` is written as ${value === "" ? "a list of lines" : `"${value}"`}, not as a [...] list.`,
      fix: `Write it as ${name}: ${asList(items)}`,
    });
  }

  // Actors as bare names: `actors: [Admin]`, or `  - Admin`.
  const actorsValue = field(fm, "actors");
  if (actorsValue !== null) {
    const bare =
      actorsValue.startsWith("[") && !actorsValue.includes("{")
        ? list(actorsValue)
        : actorsValue === ""
          ? blockItems(fm, "actors").filter((x) => !x.startsWith("{"))
          : actorsValue.startsWith("[") || actorsValue.startsWith("{")
            ? []
            : [actorsValue];
    for (const a of bare.filter((x) => !placeholder(x))) {
      out.push({
        code: "brief_wrong_shape",
        field: "actors",
        message: `The actor "${a}" is a bare name: Specgate cannot tell where ${a} uses the product.`,
        fix: `Write it as - { name: ${a}, surfaces: [${oneSurface}] }, one line under actors:, with every place ${a} uses.`,
      });
    }
  }
  return out;
}

const placeholder = (v: string) => /<[^>]+>/.test(v);
const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** What is wrong with a front matter, in plain words. Empty when it is usable. */
export function checkFrontMatter(brief: string): BriefProblem[] {
  const fm = frontMatter(brief);
  if (fm === null) return [];
  const text = uncomment(fm);
  const out: BriefProblem[] = [];
  const known = (s: string) => (SURFACES as readonly string[]).includes(s);
  const surfaceList = SURFACES.join(", ");

  const product = field(fm, "product");
  if (!product) {
    out.push({
      code: "brief_no_product",
      message: "There is no `product:` line.",
      fix: "Add one with the product in a few words, e.g. `product: Lingo — online lessons for a language school`.",
    });
  } else if (placeholder(product)) {
    out.push({
      code: "brief_placeholder",
      message: `\`product:\` still says ${product}.`,
      fix: "Replace it with your product in a few words.",
    });
  }

  const shapes = wrongShapes(fm);
  out.push(...shapes);
  const misshapen = new Set(shapes.map((p) => p.field));

  const surfaces = list(field(fm, "surfaces"));
  const unfilled = surfaces.filter(placeholder);
  if (unfilled.length > 0) {
    out.push({
      code: "brief_placeholder",
      message: `\`surfaces:\` still says ${unfilled.join(", ")}.`,
      fix: `Use the places people reach the product: ${surfaceList}.`,
    });
  }
  for (const s of surfaces.filter((x) => !placeholder(x))) {
    if (!known(s.toLowerCase())) {
      out.push({
        code: "brief_unknown_surface",
        message: `\`surfaces:\` names "${s}", which Specgate cannot check.`,
        fix: `Use ${surfaceList}. A tablet or a kiosk is \`web\` or \`mobile\`; another system calling yours is \`api\`.`,
      });
    }
  }

  // Every `name:` is an actor; the checklist only reads `{ name: X, surfaces: [..] }`.
  const named = [...text.matchAll(/\bname:\s*([^,}\n]+)/g)].map((m) => m[1].trim());
  const actors = actorSurfaces(brief);
  if (named.length === 0 && !misshapen.has("actors")) {
    out.push({
      code: "brief_no_actors",
      message: "There is no `actors:` list.",
      fix: "Name everyone who uses the product and where: `- { name: Student, surfaces: [web, mobile] }`.",
    });
  }
  for (const name of named) {
    if (placeholder(name)) {
      out.push({
        code: "brief_placeholder",
        message: `An actor is still called ${name}.`,
        fix: "Name the person or system, e.g. Teacher, Student, Payment provider.",
      });
      continue;
    }
    const theirs = actors.get(name.toLowerCase());
    if (!theirs || theirs.length === 0) {
      out.push({
        code: "brief_actor_without_surfaces",
        message: `${name} has no surfaces.`,
        fix: `Write it as \`- { name: ${name}, surfaces: [web] }\`, with every place ${name} uses.`,
      });
      continue;
    }
    for (const s of theirs) {
      if (placeholder(s)) {
        out.push({
          code: "brief_placeholder",
          message: `${name}'s surfaces still say ${s}.`,
          fix: `Use ${surfaceList}.`,
        });
      } else if (!known(s)) {
        out.push({
          code: "brief_unknown_surface",
          message: `${name} uses "${s}", which Specgate cannot check.`,
          fix: `Use ${surfaceList}. A tablet or a kiosk is \`web\` or \`mobile\`.`,
        });
      } else if (surfaces.length > 0 && !surfaces.map((x) => x.toLowerCase()).includes(s)) {
        out.push({
          code: "brief_surface_not_in_product",
          message: `${name} uses ${s}, but \`surfaces:\` does not list it.`,
          fix: `Add ${s} to \`surfaces:\`, or take it off ${name}.`,
        });
      }
    }
  }

  const modules = briefModules(brief);
  if (modules.length === 0 && !misshapen.has("modules")) {
    out.push({
      code: "brief_no_modules",
      message: "There is no `modules:` list, or it is empty.",
      fix: "List the pieces to build, in order: `modules: [courses, lessons, exercises]`.",
    });
  }
  const unnamed = modules.filter(placeholder);
  if (unnamed.length > 0) {
    out.push({
      code: "brief_placeholder",
      message: `\`modules:\` still says ${unnamed.join(", ")}.`,
      fix: "Name the pieces of the product you will build, e.g. courses, lessons, exercises.",
    });
  }
  const seen = new Set<string>();
  for (const m of modules.filter((x) => !placeholder(x))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m)) {
      out.push({
        code: "brief_module_name",
        message: `The module "${m}" has spaces, capitals or symbols.`,
        fix: `Write it as ${kebab(m) || "lowercase-words"} — it becomes a folder and a command: specgate propose --from-brief ${kebab(m) || "<module>"}.`,
      });
    } else if (seen.has(m)) {
      out.push({
        code: "brief_module_twice",
        message: `The module "${m}" is listed twice.`,
        fix: "Keep one.",
      });
    }
    seen.add(m);
  }
  return out;
}

/** The front matter to paste, with every field explained beside an example. */
export const FRONT_MATTER_EXAMPLE = [
  "---",
  "product: Lingo — online lessons for a language school",
  "surfaces: [api, web, mobile]",
  "actors:",
  "  - { name: Teacher, surfaces: [api, web] }",
  "  - { name: Student, surfaces: [api, web, mobile] }",
  "modules: [courses, lessons, exercises, progress]",
  "---",
].join("\n");

/** What `specgate draft` prints when the brief has no front matter. */
export function frontMatterExplanation(brief: string, incomplete = false): string {
  return [
    // REQ-252: over one that exists, "no front matter yet" read as a bug.
    incomplete
      ? `  The front matter at the top of ${brief} is incomplete. These are the four fields`
      : `  Your brief has no front matter yet: four fields at the very top of ${brief}`,
    "  that tell Specgate what to draft, and what to check each draft against.",
    "  Your text below them stays exactly as it is.",
    "",
    "  product   What you are building, in a few words.",
    "            product: Lingo — online lessons for a language school",
    "",
    `  surfaces  Where people reach it. Any of: ${SURFACES.join(", ")}.`,
    "            api means another program calls it; web, mobile and desktop are screens.",
    "            surfaces: [api, web, mobile]",
    "",
    "  actors    Everyone who uses it, and where. Each gets a scenario on each of",
    "            their surfaces — so no screen is forgotten. (In the first pilot every",
    "            requirement was done and nobody could use the product: there was",
    "            not a single screen.) Only people and systems your brief mentions.",
    "            actors:",
    "              - { name: Teacher, surfaces: [api, web] }",
    "              - { name: Student, surfaces: [api, web, mobile] }",
    "",
    "  modules   The pieces to specify and build, in the order you will build them.",
    "            Each small enough to review in one sitting — 25 requirements at",
    "            most. Lowercase words with dashes; each becomes",
    "            `specgate propose --from-brief <module>`.",
    "            modules: [courses, lessons, exercises, progress]",
    "",
    "  The whole block, to paste at the top and change:",
    "",
    ...FRONT_MATTER_EXAMPLE.split("\n").map((l) => `    ${l}`),
    "",
  ].join("\n");
}

/** What a good brief is, for a person who has none yet. */
export function noBriefExplanation(brief: string): string {
  return [
    `  No brief yet. Specgate drafts your specification from a brief: ${brief}.`,
    "",
    "  A brief is whatever says what the product must do — your own plan, a",
    "  client's email, meeting notes. Any markdown. Paste it as it is: Specgate",
    "  never rewrites it, and checks every draft against its words.",
    "",
    "  A good brief says:",
    "    · what the product is, and for whom",
    "    · who uses it, and where — on the web, on a phone, through an API",
    "    · what each of them must be able to do",
    "    · the rules and numbers you already know — prices, limits, deadlines",
    "    · what you don't know yet — those become questions, not guesses",
    "    · what is out of scope",
    "",
    "  Already have one?  Save it as docs/brief.md, then  specgate propose --from-brief",
    "  Starting fresh?    specgate propose --from-brief --new-brief   writes one to fill in",
    "",
  ].join("\n");
}

/** `docs/brief.md` from `specgate draft --new-brief`: the fields, then a card per module (ADR-0038). */
export const BRIEF_TEMPLATE = `---
# The product, in a few words.
# Example: Lingo — online lessons for a language school
product: <your product>
# Where people reach it. Any of: api, web, mobile, desktop.
# api means another program calls it; the others are screens.
# Example: [api, web, mobile]
surfaces: [<surface>, <surface>]
# Everyone who uses it, and where. Each gets a scenario on each of their
# surfaces, so no screen is forgotten. Example:
#   - { name: Teacher, surfaces: [api, web] }
#   - { name: Student, surfaces: [api, web, mobile] }
actors:
  - { name: <Actor>, surfaces: [<surface>] }
# The pieces to specify and build, in the order you will build them, each
# small enough to review in one sitting. Lowercase words with dashes.
# Example: [courses, lessons, exercises, progress]
modules: [<first-module>, <second-module>]
# Optional: what the product will not do, at least for now.
# non_goals: [payments, video calls]
---

# <your product>

## Why

<!-- The problem in two sentences, and one or two successes you can measure:
     "a student finds today's lesson in under 10 seconds", never "fast". -->

## Glossary

<!-- The words of this business, one line each. Example:
     - level: A1 to C2 of the CEFR -->

## Module: <first-module>

<!-- One section per module, in the order of modules:. Example:
     Rules
     - A course holds at most 12 students.
     - When a course is full, joining it is refused with "This course is full".
     Examples
     - The one where Ana joins "Spanish A2", which has 11 students.
     - The one where Ana tries to join "Spanish A2", which has 12.
     Questions
     - Can a student be in two courses at once? -->

Rules
- <one sentence: what must hold>

Examples
- <the one where …>

Questions
- <what you do not know yet>

## Notes

<!-- Anything else, as it is: the client's email, meeting notes. -->
`;

/** Where the guide for an agent proposing the front matter is written. */
export const BRIEF_SETUP_FILE = "docs/specs/BRIEF-SETUP.md";

/**
 * A brief at the project's root that `docs/brief.md` does not hold yet
 * (REQ-251): the client's text pushed first, forja's template written beside
 * it. Its file name, or null.
 */
export function rootBrief(projectDir: string, docsBrief: string): string | null {
  let names: string[];
  try {
    names = fs.readdirSync(projectDir).filter((n) => /^brief\.md$/i.test(n));
  } catch {
    return null;
  }
  for (const name of names) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(projectDir, name), "utf8");
    } catch {
      continue;
    }
    const first = text.split(/\r?\n/).find((l) => l.trim() !== "");
    if (first && !docsBrief.includes(first.trim())) return name;
  }
  return null;
}

/** The guide an agent follows to propose a front matter. */
export function briefSetupGuide(brief: string): string {
  return [
    "# Propose the brief's front matter",
    "",
    `Read \`${brief}\` and add a front matter at its very top: the lines between`,
    "two `---` that tell Specgate what to draft. A person reviews what you write.",
    "",
    "## The rules",
    "",
    `- **Change nothing below the front matter.** The brief is the client's words;`,
    "  if a single character of it changes, your work is undone.",
    "- **Only what the brief states.** Never invent an actor, a surface or a module",
    "  the brief does not support. When you are unsure, still propose it, with a",
    "  `# check: …` comment on the line above saying what is uncertain.",
    "- **Each actor as the brief writes it, in the brief's language.** A brief in",
    '  Spanish that says "el despachador" gets `Despachador`, not `Dispatcher`:',
    "  the checks look for the actor's name in the brief.",
    `- Write only \`${brief}\`. Anything else you write is undone.`,
    "",
    "## The fields",
    "",
    "```yaml",
    "---",
    "product: <the product, in a few words>",
    `surfaces: [<where people reach it: ${SURFACES.join(", ")}>]`,
    "actors:",
    "  - { name: <a person or system the brief names>, surfaces: [<where they use it>] }",
    "modules: [<pieces to build, in build order>]",
    "---",
    "```",
    "",
    `- \`surfaces\`: only ${SURFACES.join(", ")}. \`api\` means another program calls`,
    "  the product; `web`, `mobile` and `desktop` are screens.",
    "- `actors`: one line each, in exactly that `{ name: …, surfaces: [...] }` form.",
    "  Every surface of an actor is also in `surfaces`.",
    "- `modules`: lowercase words with dashes, three to eight of them. In the order",
    "  they can be built — what others depend on first. Each small enough to review",
    "  in one sitting: 25 requirements at most. A brief of more phases than that is",
    "  several deliveries: keep the first ones, and say so with `# check:`.",
    "- When `forja.config.json` lists the project's `platforms`, give actors only",
    "  those surfaces (and `api`); note a surface the brief asks for and the project",
    "  lacks — a mobile app, say — with `# check:` instead.",
    "",
    "## Then",
    "",
    "Run `specgate propose --from-brief` and fix anything it reports about the front matter.",
    "Stop there and show the front matter to the person: they review it before",
    "anything is drafted. Do not run `specgate propose --from-brief <module>`.",
    "",
  ].join("\n");
}

/** The prompt `--agent` sends, and the line to paste into any agent. */
export const BRIEF_SETUP_PASTE = `Propose the front matter of docs/brief.md: follow ${BRIEF_SETUP_FILE}`;

export function briefSetupPrompt(guide: string): string {
  return [
    `Propose the front matter of docs/brief.md, following the guide below (also saved as ${BRIEF_SETUP_FILE}).`,
    // #106: the guide says to run `specgate draft`, which is right when it is
    // pasted into an agent; under --agent the agent may only edit, and asked
    // the person to approve a command Specgate was about to run anyway.
    `Specgate runs \`specgate propose --from-brief\` itself as soon as you finish and shows the person the result: do not run it, and do not ask for permission to.`,
    "",
    "---",
    "",
    guide,
  ].join("\n");
}

/** Where the guide for an agent proposing the module sections is written. */
export const BRIEF_CARDS_FILE = "docs/specs/BRIEF-CARDS.md";

/** The line to paste into any agent to have it propose the module sections. */
export const BRIEF_CARDS_PASTE = `Propose the module sections of docs/brief.md: follow ${BRIEF_CARDS_FILE}`;

/** The guide an agent follows to propose a section per module (ADR-0038). */
export function briefCardsGuide(brief: string, modules: string[]): string {
  return [
    "# Propose the brief's module sections",
    "",
    `Read \`${brief}\` and add, at its end, one section per module of its front`,
    `matter — ${modules.map((m) => `\`${m}\``).join(", ")} — in that order. A person reviews what you write.`,
    "",
    "## The rules",
    "",
    "- **Keep every line that is there.** Add sections below the text; never",
    "  change, move or delete a line of it. If one line is lost, your work is undone.",
    "- **Only what the brief states.** Every rule, example and question comes from",
    "  the brief's own text. A value the brief does not give is a question, never a",
    "  guess.",
    `- Write only \`${brief}\`. Anything else you write is undone.`,
    "",
    "## Each section",
    "",
    "```markdown",
    "## Module: courses",
    "",
    "Rules",
    "- A course holds at most 12 students.",
    '- When a course is full, joining it is refused with "This course is full".',
    "",
    "Examples",
    '- The one where Ana joins "Spanish A2", which has 11 students.',
    '- The one where Ana tries to join "Spanish A2", which has 12.',
    "",
    "Questions",
    "- Can a student be in two courses at once?",
    "```",
    "",
    "- **Rules**: one sentence each, what must hold. Open with the condition when",
    '  there is one: "When …, …", "If …, then …". Numbers with their unit; labels',
    "  and messages in double quotes, exactly as the brief writes them.",
    '- **Examples**: at least one per rule, "The one where …", with the rule\'s own',
    "  values.",
    "- **Questions**: what the brief leaves open about this module, at most three.",
    "",
    "## Then",
    "",
    "Stop and show the sections to the person: they review them before anything",
    "is drafted.",
    "",
  ].join("\n");
}

export function briefCardsPrompt(guide: string): string {
  return [
    `Propose the module sections of docs/brief.md, following the guide below (also saved as ${BRIEF_CARDS_FILE}).`,
    "Specgate checks the brief itself as soon as you finish: do not run it, and do not ask for permission to.",
    "",
    "---",
    "",
    guide,
  ].join("\n");
}

/**
 * Whether every non-blank line of `before` is still in `after`, in order.
 * An agent adding sections may add lines anywhere; it may not lose one.
 */
export function keepsEveryLine(before: string, after: string): boolean {
  const want = before.split(/\r?\n/).filter((l) => l.trim() !== "");
  const have = after.split(/\r?\n/);
  let at = 0;
  for (const line of have) {
    if (at < want.length && line === want[at]) at += 1;
  }
  return at === want.length;
}
