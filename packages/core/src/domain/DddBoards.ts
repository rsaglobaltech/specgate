/**
 * DDD workshop boards as a source of the brief (brief-from-workshop REQ-655,
 * ported from the studio's spike, issue #59): the
 * files DDD Toolbox exports — a tldraw document, its records in `store` —
 * read into one domain model. Pure. Only the files' records are read, by their
 * shape; nothing of DDD Toolbox is used (AGPL-3.0). The model is structure:
 * the drafting agent words it, in the team's language.
 */

interface RecordLike {
  id?: unknown;
  typeName?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  parentId?: unknown;
  fromId?: unknown;
  toId?: unknown;
  props?: Record<string, unknown>;
}

const recordsOf = (snapshot: unknown): RecordLike[] => {
  const s = snapshot as { store?: unknown; document?: { store?: unknown } } | null;
  const store = (s && typeof s === "object" && (s.store ?? s.document?.store)) || null;
  return store && typeof store === "object"
    ? Object.values(store as Record<string, unknown>).filter(
        (r): r is RecordLike => !!r && typeof r === "object"
      )
    : [];
};
const shapesOf = (snapshot: unknown) => recordsOf(snapshot).filter((r) => r.typeName === "shape");

/** The text of a label: plain, or tldraw 4's rich text (a TipTap document). */
function textOf(v: unknown): string {
  if (typeof v === "string") return v.trim();
  const out: string[] = [];
  const walk = (n: unknown, para = false) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof node.text === "string") out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach((c) => walk(c, node.type === "doc"));
    if (para && node.type === "paragraph") out.push("\n");
  };
  walk(v);
  return out.join("").trim();
}
const labelOf = (r: RecordLike) => textOf(r.props?.text ?? r.props?.richText ?? "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

// ── Domain Storytelling (REQ-313) ─────────────────────────────────────────

export interface StorySentence {
  /** The activity's number on the board. */
  n: number;
  actor: string;
  activity: string;
  object: string;
  /** Whom the work object goes to next. */
  to: string[];
}

export type ActorKind = "person" | "group" | "system";

export interface DomainStory {
  actors: string[];
  actorKinds: Array<{ name: string; kind: ActorKind }>;
  workObjects: string[];
  sentences: StorySentence[];
  comments: string[];
}

/** A Domain Storytelling board: actors, work objects, its numbered activities, its comments. */
export function storyOf(snapshot: unknown): DomainStory {
  const records = recordsOf(snapshot);
  const shapes = new Map(
    records
      .filter((r) => r.typeName === "shape" && typeof r.id === "string")
      .map((r) => [r.id as string, r])
  );
  const ends = new Map<string, { start?: string; end?: string }>();
  for (const b of records) {
    if (b.typeName !== "binding" || b.type !== "arrow" || typeof b.fromId !== "string") continue;
    const terminal = b.props?.terminal;
    const e = ends.get(b.fromId) ?? {};
    if (terminal === "start" || terminal === "end") e[terminal] = String(b.toId);
    ends.set(b.fromId, e);
  }
  const kindOf = (id: string | undefined) => (id ? shapes.get(id)?.type : undefined);
  const nameOf = (id: string | undefined) => (id ? labelOf(shapes.get(id) ?? {}) : "");

  const arrows = [...shapes.values()]
    .filter((s) => s.type === "arrow")
    .map((a) => ({ a, ...(ends.get(a.id as string) ?? {}), label: labelOf(a) }));
  const sentences: StorySentence[] = [];
  for (const x of arrows) {
    const m = /^(\d+)\.\s*(.*)$/s.exec(x.label);
    if (!m || kindOf(x.start) !== "actor" || kindOf(x.end) !== "work-object") continue;
    const to = arrows
      .filter((y) => y.start === x.end && kindOf(y.end) === "actor" && !/^\d+\./.test(y.label))
      .map((y) => nameOf(y.end))
      .filter((n) => n && n !== nameOf(x.start));
    sentences.push({
      n: Number(m[1]),
      actor: nameOf(x.start),
      activity: m[2]!.trim(),
      object: nameOf(x.end),
      to: [...new Set(to)],
    });
  }
  sentences.sort((a, b) => a.n - b.n);
  const all = [...shapes.values()];
  const named = (type: string) =>
    [
      ...new Set(
        all
          .filter((s) => s.type === type)
          .map(labelOf)
          .filter(Boolean)
      ),
    ].sort();
  const actorKinds = [
    ...new Map(
      all
        .filter((s) => s.type === "actor" && labelOf(s))
        .map((s) => {
          const icon = String(s.props?.icon ?? "");
          const kind: ActorKind = /server|database|cpu|cloud/.test(icon)
            ? "system"
            : /users|building/.test(icon)
              ? "group"
              : "person";
          return [labelOf(s), { name: labelOf(s), kind }] as const;
        })
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const comments = all
    .filter((s) => s.type === "comment")
    .sort((a, b) => num(a.y) - num(b.y) || num(a.x) - num(b.x))
    .map(labelOf)
    .filter(Boolean);
  return {
    actors: named("actor"),
    actorKinds,
    workObjects: named("work-object"),
    sentences,
    comments,
  };
}

/** The use case a story proposes, as structure: its first actor, its activities in order. */
export function useCaseOf(story: DomainStory): {
  primaryActor: string | null;
  steps: StorySentence[];
} {
  return { primaryActor: story.sentences[0]?.actor ?? null, steps: [...story.sentences] };
}

// ── Event Storming (REQ-314) ──────────────────────────────────────────────

export interface EventFlow {
  /** Who issues the command. */
  actor: string | null;
  command: string | null;
  /** The event a policy reacts to. */
  trigger: string | null;
  policy: string | null;
  /** What comes of it: every event after the command or the policy. */
  events: string[];
  /** External systems beside it. */
  systems: string[];
  /** Read models beside it. */
  views: string[];
}

export interface EventStormingBoard {
  flows: EventFlow[];
  /** Hotspots: questions for the business. */
  questions: string[];
  /** Constraints: business rules. */
  rules: string[];
  /** Every read model on the wall. */
  views: string[];
  /** Notes no flow could take: kept, never dropped. */
  unread: Array<{ kind: string; text: string }>;
}

interface Note {
  kind: string;
  text: string;
  x: number;
  y: number;
  group: string | null;
}

/** The wall's rows, top to bottom, for notes at the same place on the timeline. */
const ROW_ORDER: Record<string, number> = {
  actor: 0,
  system: 1,
  "query-model": 2,
  command: 3,
  event: 4,
  policy: 5,
};
const byTimeline = (a: Note, b: Note) =>
  a.x - b.x || (ROW_ORDER[a.kind] ?? 9) - (ROW_ORDER[b.kind] ?? 9) || a.y - b.y;

const newFlow = (o: Partial<EventFlow>): EventFlow => ({
  actor: null,
  command: null,
  trigger: null,
  policy: null,
  events: [],
  systems: [],
  views: [],
  ...o,
});
const addOnce = (list: string[], v: string) => void (list.includes(v) || list.push(v));

/** A group of notes the team grouped: one flow. */
function groupFlow(notes: Note[]): EventFlow {
  const sorted = [...notes].sort(byTimeline);
  const first = (kind: string) => sorted.find((n) => n.kind === kind) ?? null;
  const policy = first("policy");
  const command = first("command");
  const trigger =
    policy && !command ? (sorted.find((n) => n.kind === "event" && n.x <= policy.x) ?? null) : null;
  const f = newFlow({
    actor: first("actor")?.text ?? null,
    command: command?.text ?? null,
    trigger: trigger?.text ?? null,
    policy: policy?.text ?? null,
  });
  for (const n of sorted) {
    if (n.kind === "event" && n !== trigger) addOnce(f.events, n.text);
    if (n.kind === "system") addOnce(f.systems, n.text);
    if (n.kind === "query-model") addOnce(f.views, n.text);
  }
  return f;
}

/**
 * An Event Storming wall: each group a flow; the notes the team only laid
 * along the timeline read as a wall is read — a command or a policy starts a
 * flow, the actor before it its actor, the event before a policy its trigger,
 * every event after it an outcome, the systems beside it attached.
 */
export function eventStormingOf(snapshot: unknown): EventStormingBoard {
  const shapes = shapesOf(snapshot);
  // A grouped note's place is its group's place plus its own, as tldraw keeps it.
  const groupAt = new Map(
    shapes
      .filter((r) => r.type === "group")
      .map((r) => [r.id as string, { x: num(r.x), y: num(r.y) }])
  );
  const groups = new Set(groupAt.keys());
  const notes: Note[] = shapes
    .filter((r) => r.type === "sticky-note")
    .map((r) => ({
      kind: String(r.props?.stickyNoteType ?? ""),
      text: labelOf(r),
      x: num(r.x) + (groupAt.get(r.parentId as string)?.x ?? 0),
      y: num(r.y) + (groupAt.get(r.parentId as string)?.y ?? 0),
      group: typeof r.parentId === "string" && groups.has(r.parentId) ? r.parentId : null,
    }))
    .filter((n) => n.text);

  const entries: Array<{ x: number; flow: EventFlow }> = [];
  const byGroup = new Map<string, Note[]>();
  for (const n of notes) if (n.group) byGroup.set(n.group, [...(byGroup.get(n.group) ?? []), n]);
  for (const list of byGroup.values())
    entries.push({ x: Math.min(...list.map((n) => n.x)), flow: groupFlow(list) });

  const unread: EventStormingBoard["unread"] = [];
  const wall = notes
    .filter((n) => !n.group && ["actor", "command", "event", "policy", "system"].includes(n.kind))
    .sort(byTimeline);
  let current: EventFlow | null = null;
  let actor: Note | null = null;
  let lastEvent: string | null = null;
  const waiting: string[] = [];
  for (const n of wall) {
    if (n.kind === "actor") {
      if (actor) unread.push({ kind: "actor", text: actor.text });
      actor = n;
    } else if (n.kind === "command" || n.kind === "policy") {
      current =
        n.kind === "command"
          ? newFlow({ actor: actor?.text ?? null, command: n.text })
          : newFlow({ trigger: lastEvent, policy: n.text });
      if (n.kind === "policy" && actor) unread.push({ kind: "actor", text: actor.text });
      actor = null;
      current.systems.push(...waiting.splice(0));
      entries.push({ x: n.x, flow: current });
    } else if (n.kind === "event") {
      lastEvent = n.text;
      if (current && n.text !== current.trigger) addOnce(current.events, n.text);
      else if (!current) unread.push({ kind: "event", text: n.text });
    } else if (n.kind === "system") {
      if (current) addOnce(current.systems, n.text);
      else waiting.push(n.text);
    }
  }
  if (actor) unread.push({ kind: "actor", text: actor.text });
  for (const s of waiting) unread.push({ kind: "system", text: s });

  const of = (kind: string) => notes.filter((n) => n.kind === kind).map((n) => n.text);
  return {
    flows: entries.sort((a, b) => a.x - b.x).map((e) => e.flow),
    questions: of("hotspot"),
    rules: of("constraint"),
    views: of("query-model"),
    unread,
  };
}

// ── Bounded Context Canvas (REQ-315) ──────────────────────────────────────

export interface Integration {
  collaborator: string;
  kind: string;
  /** ACL, OHS, CF, CUS, SUP, PNR or SK, when the canvas says it. */
  relationship: string | null;
  messages: Array<{ label: string; type: "command" | "event" | "query" | string }>;
}

export interface BoundedContext {
  name: string;
  purpose: string;
  classification: { domain: string | null; businessModel: string | null; evolution: string | null };
  roles: string[];
  inbound: Integration[];
  outbound: Integration[];
  terms: Array<{ term: string; definition: string }>;
  decisions: string[];
  assumptions: string;
  metrics: string;
  questions: string[];
}

const lines = (s: string) =>
  s
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

/** A Bounded Context Canvas, or null for a board that is not one. */
export function canvasOf(snapshot: unknown): BoundedContext | null {
  const shapes = shapesOf(snapshot);
  const section = (type: string) => shapes.find((s) => s.type === type)?.props ?? null;
  const name = section("name-section");
  if (!name) return null;
  const text = (type: string) => textOf(section(type)?.text ?? "");
  const values = (type: string) => (section(type)?.values ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const comms = (type: string, side: "left" | "right"): Integration[] =>
    ((section(type)?.communications ?? []) as Array<Record<string, unknown>>).map((c) => ({
      collaborator: String(c.collaboratorName ?? "").trim(),
      kind: String(c.collaboratorType ?? ""),
      relationship: str(c[`${side}RelationshipType`]),
      messages: ((c.messages ?? []) as Array<Record<string, unknown>>).map((m) => ({
        label: String(m.label ?? "").trim(),
        type: String(m.type ?? ""),
      })),
    }));
  const cls = values("strategic-classification");
  const roles = values("domain-roles");
  const lang = section("ubiquitous-language-business-decisions-section") ?? {};
  return {
    name: textOf(name.text),
    purpose: text("purpose-section"),
    classification: {
      domain: str(cls.domain) ?? str(cls.customDomain),
      businessModel: str(cls.businessModel) ?? str(cls.customBusinessModel),
      evolution: str(cls.evolution) ?? str(cls.customEvolution),
    },
    roles: [
      ...(Array.isArray(roles.roles) ? (roles.roles as string[]) : []),
      ...(str(roles.customRoles) ? [roles.customRoles as string] : []),
    ],
    // The collaborator sits left of an inbound message, right of an outbound one.
    inbound: comms("inbound-communication-section", "left"),
    outbound: comms("outbound-communication-section", "right"),
    terms: ((lang.terms ?? []) as Array<Record<string, unknown>>).map((t) => ({
      term: String(t.term ?? "").trim(),
      definition: String(t.definition ?? "").trim(),
    })),
    decisions: ((lang.decisions ?? []) as Array<Record<string, unknown>>)
      .map((d) => String(d.description ?? "").trim())
      .filter(Boolean),
    assumptions: text("assumptions-section"),
    metrics: text("verification-metrics-section"),
    questions: lines(text("open-questions-section")),
  };
}

// ── One model for a workshop (REQ-316) ────────────────────────────────────

export interface ModelModule {
  /** The file's name under docs/brief/models. */
  slug: string;
  name: string;
  context: BoundedContext | null;
  /** Each flow and why it is here: "receives <command>", "sends <event>" or "assumed". */
  flows: Array<{ flow: EventFlow; by: string }>;
  stories: DomainStory[];
  rules: string[];
  questions: string[];
  views: string[];
}

export interface DomainModel {
  modules: ModelModule[];
  stories: DomainStory[];
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
export const slugOf = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "dominio";

/** A board's kind, by what it holds. */
function boardKind(snapshot: unknown): "canvas" | "story" | "event-storming" | null {
  const types = new Set(shapesOf(snapshot).map((s) => s.type));
  if (types.has("name-section")) return "canvas";
  if (types.has("sticky-note")) return "event-storming";
  if (types.has("actor") || types.has("work-object")) return "story";
  return null;
}

/**
 * A workshop's boards as one model: a module per canvas, each flow given to the
 * context that receives its command or sends its event — else to the core
 * context, said to be assumed — and the stories, rules, questions and views
 * kept with the core module.
 */
export function domainModelOf(boards: readonly unknown[]): DomainModel {
  const contexts: BoundedContext[] = [];
  const stories: DomainStory[] = [];
  const walls: EventStormingBoard[] = [];
  for (const b of boards) {
    const kind = boardKind(b);
    if (kind === "canvas") {
      // The same context twice — a file given twice — is one module.
      const c = canvasOf(b)!;
      if (!contexts.some((x) => slugOf(x.name) === slugOf(c.name))) contexts.push(c);
    } else if (kind === "story") stories.push(storyOf(b));
    else if (kind === "event-storming") walls.push(eventStormingOf(b));
  }
  const modules: ModelModule[] = contexts.map((c) => ({
    slug: slugOf(c.name),
    name: c.name,
    context: c,
    flows: [],
    stories: [],
    rules: [...c.decisions],
    questions: [...c.questions],
    views: [],
  }));
  if (modules.length === 0)
    modules.push({
      slug: "dominio",
      name: "Dominio",
      context: null,
      flows: [],
      stories: [],
      rules: [],
      questions: [],
      views: [],
    });
  const core = modules.find((m) => m.context?.classification.domain === "core") ?? modules[0]!;
  const receives = (m: ModelModule, cmd: string) =>
    !!m.context?.inbound.some((i) =>
      i.messages.some((x) => x.type === "command" && fold(x.label) === fold(cmd))
    );
  const sends = (m: ModelModule, ev: string) =>
    !!m.context?.outbound.some((i) =>
      i.messages.some((x) => x.type === "event" && fold(x.label) === fold(ev))
    );
  for (const wall of walls) {
    for (const flow of wall.flows) {
      const byCommand = flow.command ? modules.find((m) => receives(m, flow.command!)) : undefined;
      const sent = byCommand
        ? null
        : flow.events.map((e) => ({ e, m: modules.find((m) => sends(m, e)) })).find((x) => x.m);
      const m = byCommand ?? sent?.m ?? core;
      m.flows.push({
        flow,
        by: byCommand ? `receives ${flow.command}` : sent ? `sends ${sent.e}` : "assumed",
      });
    }
    core.rules.push(...wall.rules.filter((r) => !core.rules.includes(r)));
    core.questions.push(...wall.questions.filter((q) => !core.questions.includes(q)));
    core.views.push(...wall.views.filter((v) => !core.views.includes(v)));
  }
  core.stories.push(...stories);
  return { modules, stories };
}

// ── The model as files (REQ-316) ──────────────────────────────────────────

/** A YAML scalar: plain when it reads as itself, else quoted. */
function scalar(v: string | null): string {
  if (v === null) return "null";
  return /^[\p{L}\p{N}][\p{L}\p{N} ._()/%-]*$/u.test(v) &&
    !/^(true|false|null|yes|no|on|off|~)$/i.test(v) &&
    !/^[\d.]+$/.test(v)
    ? v
    : JSON.stringify(v);
}

/** A module of the model as `docs/brief/models/<slug>.yaml`: what the drafting agent reads. */
export function modelYamlOf(m: ModelModule): string {
  const out: string[] = [];
  const line = (indent: number, s: string) => out.push(`${"  ".repeat(indent)}${s}`);
  const list = (indent: number, key: string, items: readonly string[]) => {
    if (!items.length) return;
    line(indent, `${key}:`);
    for (const i of items) line(indent + 1, `- ${scalar(i)}`);
  };
  const c = m.context;
  line(0, "# From a DDD workshop (DDD Toolbox boards) — the source the drafting agent words.");
  line(0, `context: ${scalar(m.name)}`);
  line(0, `slug: ${m.slug}`);
  if (c) {
    if (c.purpose) line(0, `purpose: ${scalar(c.purpose)}`);
    line(0, "classification:");
    line(1, `domain: ${scalar(c.classification.domain)}`);
    line(1, `business_model: ${scalar(c.classification.businessModel)}`);
    line(1, `evolution: ${scalar(c.classification.evolution)}`);
    list(0, "roles", c.roles);
    const ints = [
      ...c.inbound.map((i) => ({ dir: "inbound", i })),
      ...c.outbound.map((i) => ({ dir: "outbound", i })),
    ];
    if (ints.length) {
      line(0, "integrations:");
      for (const { dir, i } of ints) {
        line(1, `- direction: ${dir}`);
        line(2, `with: ${scalar(i.collaborator)}`);
        line(2, `kind: ${i.kind}`);
        if (i.relationship) line(2, `relationship: ${i.relationship}`);
        if (i.messages.length) {
          line(2, "messages:");
          for (const x of i.messages) line(3, `- ${x.type}: ${scalar(x.label)}`);
        }
      }
    }
    if (c.terms.length) {
      line(0, "terms:");
      for (const t of c.terms) {
        line(1, `- term: ${scalar(t.term)}`);
        line(2, `definition: ${scalar(t.definition)}`);
      }
    }
    if (c.assumptions) line(0, `assumptions: ${scalar(c.assumptions)}`);
    if (c.metrics) line(0, `metrics: ${scalar(c.metrics)}`);
  }
  list(0, "rules", m.rules);
  if (m.flows.length) {
    line(0, "flows:");
    for (const { flow: f, by } of m.flows) {
      const first = f.command
        ? `command: ${scalar(f.command)}`
        : `policy: ${scalar(f.policy ?? "")}`;
      line(1, `- ${first}`);
      if (f.actor) line(2, `actor: ${scalar(f.actor)}`);
      if (f.command && f.policy) line(2, `policy: ${scalar(f.policy)}`);
      if (f.trigger) line(2, `when: ${scalar(f.trigger)}`);
      list(2, "outcomes", f.events);
      list(2, "systems", f.systems);
      list(2, "views", f.views);
      line(2, `placed: ${scalar(by)}`);
    }
  }
  if (m.stories.length) {
    line(0, "stories:");
    for (const s of m.stories) {
      line(1, `- primary_actor: ${scalar(s.sentences[0]?.actor ?? null)}`);
      line(2, "steps:");
      for (const x of s.sentences)
        line(
          3,
          `- ${scalar(`${x.n}. ${x.actor} ${x.activity} ${x.object}${x.to.length ? ` → ${x.to.join(", ")}` : ""}`)}`
        );
      list(2, "comments", s.comments);
    }
  }
  list(0, "views", m.views);
  list(0, "questions", m.questions);
  return out.join("\n") + "\n";
}
