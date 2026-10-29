/**
 * The three layers of a change (ADR-0041): what the business needs, how the
 * system will do it, and the work that does it — each with the role that owns
 * it, so a product owner, an architect and a developer each write and review
 * their own part instead of one proposal that mixes the three.
 *
 * Pure: the caller reads the files. A 0.27 change has no `discover.md`; its
 * `proposal.md` is read as the Discover, and a missing `design.md` is a
 * warning that names `specgate migrate 1.0`, never an error — a change already
 * in flight stays valid.
 */

import { Diagnostic, warning } from "./Diagnostic";
import { TECHNICAL } from "./BriefCards";

export type LayerId = "discover" | "design" | "tasks";

export interface ChangeLayer {
  id: LayerId;
  file: string;
  /** Who writes it and who approves it. */
  owner: "product" | "architect" | "developer";
  /** What the layer is for, in one line — shown by `change status` and the studio. */
  purpose: string;
}

export const LAYERS: readonly ChangeLayer[] = Object.freeze([
  {
    id: "discover",
    file: "discover.md",
    owner: "product",
    purpose: "the business context, the use case and its acceptance criteria",
  },
  {
    id: "design",
    file: "design.md",
    owner: "architect",
    purpose: "the modules, mechanisms and channels that meet each criterion",
  },
  {
    id: "tasks",
    file: "tasks.md",
    owner: "developer",
    purpose: "verifiable tasks, each naming the requirement it delivers",
  },
] as ChangeLayer[]);

/** The schema new changes follow from 1.0 on. 0.27 changes say `spec-driven`. */
export const LAYERED_SCHEMA = "layered";

/** The Discover of a 0.27 change: its proposal. */
export const LEGACY_DISCOVER = "proposal.md";

export const layer = (id: LayerId): ChangeLayer => LAYERS.find((l) => l.id === id)!;

// ── Templates ────────────────────────────────────────────────────────────────

export function templateDiscover(changeId: string): string {
  return `# Discover: ${changeId}

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

<!-- Who has the problem, and what it costs them today. -->

## Use case

<!-- What the person does, step by step, once this exists. -->

## Acceptance criteria

<!-- One line each, numbered: the design must answer every one. -->
- AC-1:
`;
}

export function templateLayeredDesign(changeId: string): string {
  return `# Design: ${changeId}

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

<!-- Which modules or services change, and what each one owns. -->

## Mechanisms

<!-- How: data, rules, flows. Answer each criterion: "AC-1 — …". -->

## Channels

<!-- APIs, events, queues between modules or repositories. -->

## Decisions

<!-- The ADRs this touches, or the choice made here and what was rejected. -->
`;
}

export function templateLayeredTasks(): string {
  return `# Tasks

> Owner: developer — each task is verifiable and names the requirement it
> delivers (REQ-NNN).

## 1. Specification

- [ ] 1.1 Write the delta spec for each affected capability
- [ ] 1.2 Run \`specgate change validate\`

## 2. Implementation

- [ ] 2.1 REQ-NNN —
`;
}

/**
 * A draft's tasks before the review: the developer's layer, with nothing to
 * tick yet — a draft has no work to check off until its requirements are
 * agreed.
 */
export function templateDraftTasks(): string {
  return `# Tasks

> Owner: developer — verifiable tasks, each naming the requirement it
> delivers (REQ-NNN). Written once the draft is reviewed.
`;
}

const normal = (t: string) => t.replace(/\r\n/g, "\n").trim();

/** True when a layer is still as `change new` wrote it: not written yet. */
export function isUntouchedLayer(id: LayerId, content: string, changeId: string): boolean {
  const template =
    id === "discover"
      ? templateDiscover(changeId)
      : id === "design"
        ? templateLayeredDesign(changeId)
        : templateLayeredTasks();
  if (id === "tasks" && normal(content) === normal(templateDraftTasks())) return true;
  return normal(content) === normal(template);
}

/**
 * A first `design.md` for a 0.27 change, from its proposal, for
 * `specgate migrate 1.0`: the proposal's Approach becomes the Mechanisms, and
 * every criterion the proposal states is listed for the architect to answer.
 */
export function designFromProposal(proposal: string, changeId: string): string {
  const approach = section(proposal, /approach|enfoque|ansatz/i);
  const criteria = acceptanceCriteria(proposal);
  const body = [
    `# Design: ${changeId}`,
    "",
    "> Owner: architect — written by `specgate migrate 1.0` from the proposal. Review it.",
    "",
    "## Modules",
    "",
    "<!-- Which modules or services change, and what each one owns. -->",
    "",
    "## Mechanisms",
    "",
    approach.trim() || "<!-- How: data, rules, flows. -->",
    "",
  ];
  if (criteria.length > 0) {
    body.push(...criteria.map((c) => `- ${c.id} — <!-- how it is met -->`), "");
  }
  body.push("## Channels", "", "<!-- APIs, events, queues. -->", "", "## Decisions", "", "");
  return body.join("\n");
}

// ── Reading the layers ───────────────────────────────────────────────────────

/** The text under the first `##` heading matching `heading`, up to the next `##`. */
function section(md: string, heading: RegExp): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (start < 0) return "";
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (/^##\s/.test(l)) break;
    out.push(l);
  }
  return out.join("\n");
}

const withoutComments = (t: string) => t.replace(/<!--[\s\S]*?-->/g, "");

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

/**
 * The numbered criteria of a Discover: `- AC-1: text` (or `—`, `-`) under
 * "Acceptance criteria" ("Criterios de aceptación", "Akzeptanzkriterien").
 * A criterion with no text yet is not one.
 */
export function acceptanceCriteria(discover: string): AcceptanceCriterion[] {
  const body = withoutComments(
    section(discover, /acceptance criteria|criterios de aceptaci[oó]n|akzeptanzkriterien/i)
  );
  const out: AcceptanceCriterion[] = [];
  for (const m of body.matchAll(/^\s*[-*]\s*(AC-\d+)\s*[:—–-]\s*(.*\S)\s*$/gm)) {
    out.push({ id: m[1], text: m[2] });
  }
  return out;
}

/** Words of how, in a layer about what: the brief's list plus the architecture's. */
const DISCOVER_TECHNICAL = new RegExp(
  `${TECHNICAL.source}|\\b(api|apis|endpoints?|database|base de datos|sql|rest|http|json|microservices?|microservicios?|queue|cola de mensajes|controllers?|tables?|tablas?)\\b`,
  "i"
);

export interface LayerFiles {
  changeId: string;
  /** `discover.md`, or for a 0.27 change its `proposal.md`. */
  discover: string | null;
  /** Which file `discover` came from. */
  discoverFile: string;
  design: string | null;
  tasks: string | null;
}

/**
 * The layer rules (REQ-284..REQ-286), plus the 0.27 notice (REQ-283). All
 * warnings: a change is drafted one layer at a time, and the project's gate
 * must not fail while the architect has not written the design yet.
 * `change validate --strict` fails on them.
 */
export function checkLayers(files: LayerFiles): Diagnostic[] {
  const out: Diagnostic[] = [];
  const dir = `docs/specs/changes/${files.changeId}`;
  const legacy = files.discoverFile === LEGACY_DISCOVER;

  if (files.design === null) {
    out.push(
      warning(
        "layer_no_design",
        legacy
          ? `Change "${files.changeId}" has the 0.27 layout: a proposal and no design.md.`
          : `Change "${files.changeId}" has no design.md.`,
        {
          target: files.changeId,
          file: `${dir}/design.md`,
          fix: legacy
            ? "Run `specgate migrate 1.0` to add its design.md from the proposal, or write one: the architect's layer."
            : "Write design.md: the architect's layer, answering each acceptance criterion.",
        }
      )
    );
  }

  const discover = files.discover && withoutComments(files.discover);
  // The rules below judge the layers of a 1.0 change; a proposal was never
  // written to them.
  if (legacy || !discover) return out;

  // REQ-284: the Discover is the business story.
  const tech = DISCOVER_TECHNICAL.exec(discover);
  if (tech) {
    out.push(
      warning("layer_discover_technical", `discover.md names ${tech[0]}: how, not what.`, {
        target: files.changeId,
        file: `${dir}/${files.discoverFile}`,
        fix: "Say what the business needs; the technology goes in design.md.",
      })
    );
  }

  // REQ-285: the design answers every criterion.
  const criteria = acceptanceCriteria(files.discover || "");
  if (files.design !== null && criteria.length > 0) {
    const design = withoutComments(files.design);
    for (const c of criteria) {
      if (!new RegExp(`\\b${c.id}\\b`).test(design)) {
        out.push(
          warning(
            "layer_design_misses_criterion",
            `design.md does not answer ${c.id}: "${c.text}".`,
            {
              target: c.id,
              file: `${dir}/design.md`,
              fix: `Say in design.md how ${c.id} is met, naming it ("${c.id} — …").`,
            }
          )
        );
      }
    }
  }

  // REQ-286: every task names the requirement it delivers — once the
  // developer has written them; the template's placeholder is not a task.
  if (files.tasks !== null && !isUntouchedLayer("tasks", files.tasks, files.changeId)) {
    const lines = files.tasks.replace(/\r\n/g, "\n").split("\n");
    let heading = "";
    lines.forEach((l, i) => {
      if (/^##\s/.test(l)) heading = l;
      const task = /^\s*[-*]\s*\[[ xX]\]\s*(.*)$/.exec(l);
      if (!task) return;
      // The specification tasks are the process, not a requirement's work.
      if (/specification|especificaci[oó]n|spezifikation/i.test(heading)) return;
      if (/\bREQ-\d+\b/.test(task[1])) return;
      out.push(
        warning(
          "layer_task_without_requirement",
          `Task "${task[1].trim() || "(empty)"}" names no requirement.`,
          {
            target: files.changeId,
            file: `${dir}/tasks.md`,
            line: i + 1,
            fix: "Name the requirement the task delivers (REQ-NNN), or move it under the specification tasks.",
          }
        )
      );
    });
  }
  return out;
}

/**
 * REQ-287: whether the Discover differs from the version it was agreed at —
 * the one approved, or else the first committed. Whitespace and comments do not
 * count: rewording a placeholder is not a new story.
 */
export function discoverRewritten(baseline: string, current: string): boolean {
  const flat = (t: string) => withoutComments(t).replace(/\s+/g, " ").trim();
  return flat(baseline) !== flat(current);
}
