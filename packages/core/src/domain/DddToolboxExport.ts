/**
 * The domain model exported as boards DDD Toolbox opens (brief-domain-views
 * REQ-659): a Bounded Context Canvas per context, one Event Storming board of
 * every flow along the timeline, a Domain Storytelling board per story. Built
 * from record templates DDD Toolbox itself saved — its file format, data, none
 * of its code. Pure: the model and the templates in, the boards out.
 */
import type { DomainView, ViewFlow, ViewModule, ViewStory } from "./DomainView";

type Rec = Record<string, unknown> & { id: string; props?: Record<string, unknown> };

export interface BoardTemplates {
  schema: { story: unknown; eventStorming: unknown; canvas: unknown };
  document: Rec;
  page: Rec;
  shapes: Record<"actor" | "work-object" | "arrow" | "comment" | "sticky-note" | "group", Rec>;
  binding: Rec;
  canvas: Rec[];
}

export interface ExportedBoard {
  /** The file's name: `<context>-canvas.json`, `event-storming.json`, `story-<n>.json`. */
  file: string;
  board: { store: Record<string, Rec>; schema: unknown };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** tldraw's fractional index for the i-th shape: "a1"… then "b10"…, always in order. */
export function indexAt(i: number): string {
  if (i < 61) return `a${DIGITS[i + 1]}`;
  const j = i - 61 + 62; // two base-62 digits, the first never 0
  return `b${DIGITS[Math.floor(j / 62)]}${DIGITS[j % 62]}`;
}
const rich = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

class Board {
  private readonly store: Record<string, Rec> = {};
  private n = 0;
  constructor(
    private readonly t: BoardTemplates,
    private readonly schema: unknown
  ) {
    this.put(clone(t.document));
    this.put(clone(t.page));
  }
  put(r: Rec): Rec {
    this.store[r.id] = r;
    return r;
  }
  shape(
    kind: keyof BoardTemplates["shapes"],
    id: string,
    x: number,
    y: number,
    props: Record<string, unknown>,
    parentId = this.t.page.id
  ): Rec {
    const r = clone(this.t.shapes[kind]);
    return this.put({
      ...r,
      id: `shape:${id}`,
      x,
      y,
      parentId,
      index: indexAt(this.n++),
      props: { ...r.props, ...props },
    });
  }
  bind(arrow: string, terminal: "start" | "end", to: string): void {
    const b = clone(this.t.binding);
    this.put({
      ...b,
      id: `binding:${arrow}-${terminal}`,
      fromId: `shape:${arrow}`,
      toId: `shape:${to}`,
      props: { ...(b.props as object), terminal },
    });
  }
  done(file: string): ExportedBoard {
    return { file, board: { store: this.store, schema: this.schema } };
  }
}

const id = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .slice(0, 40);

/** A context as its Bounded Context Canvas. */
function canvasOf(t: BoardTemplates, m: ViewModule): ExportedBoard {
  const b = new Board(t, t.schema.canvas);
  let k = 0;
  const uid = () => `x${k++}`;
  const comms = (dir: "inbound" | "outbound") =>
    m.integrations
      .filter((i) => i.direction === dir)
      .map((i) => ({
        id: uid(),
        collaboratorName: i.with,
        collaboratorType: i.kind || "bounded-context",
        ...(i.relationship
          ? {
              [dir === "inbound" ? "leftRelationshipType" : "rightRelationshipType"]:
                i.relationship,
            }
          : {}),
        messages: i.messages.map((x) => ({ id: uid(), label: x.label, type: x.type })),
      }));
  const values: Record<string, Record<string, unknown>> = {
    "name-section": { text: m.name },
    "purpose-section": { text: m.purpose },
    "strategic-classification": {
      values: Object.fromEntries(Object.entries(m.classification).filter(([, v]) => v !== null)),
    },
    "domain-roles": { values: m.roles.length ? { roles: m.roles } : {} },
    "inbound-communication-section": { communications: comms("inbound") },
    "outbound-communication-section": { communications: comms("outbound") },
    "ubiquitous-language-business-decisions-section": {
      terms: m.terms.map((x) => ({ id: uid(), term: x.term, definition: x.definition })),
      decisions: m.rules.map((description) => ({ id: uid(), description })),
    },
    // The section holds a few lines: the rest are the wall's hotspots.
    "open-questions-section": {
      text: [
        ...m.questions.slice(0, 2),
        ...(m.questions.length > 2 ? [`(+${m.questions.length - 2} in the Event Storming)`] : []),
      ].join("\n"),
    },
    "assumptions-section": { text: m.assumptions },
    "verification-metrics-section": { text: m.metrics },
  };
  for (const section of t.canvas) {
    const r = clone(section);
    b.put({ ...r, props: { ...r.props, ...(values[String(r.type)] ?? {}) } });
  }
  return b.done(`${m.slug}-canvas.json`);
}

/** Every flow along one wall: each a group of notes, the wall's rows top to bottom. */
function eventStormingOf(t: BoardTemplates, model: DomainView): ExportedBoard {
  const b = new Board(t, t.schema.eventStorming);
  const ROW = { actor: 0, system: 0, view: 0, command: 220, event: 440, policy: 660 };
  let x = 0;
  let n = 0;
  const flows: ViewFlow[] = model.modules.flatMap((m) => m.flows);
  for (const f of flows) {
    const g = `g${n}`;
    const group = b.shape("group", g, x, 0, {});
    const parent = group.id;
    const note = (kind: string, text: string, dx: number, row: number) =>
      b.shape(
        "sticky-note",
        `n${n}_${dx}_${row}_${id(text)}`,
        dx,
        row,
        { text, stickyNoteType: kind },
        parent
      );
    let col = 0;
    if (f.policy) {
      if (f.trigger) note("event", f.trigger, 0, ROW.event);
      note("policy", f.policy, 0, ROW.policy);
    } else {
      if (f.actor) note("actor", f.actor, 0, ROW.actor);
      if (f.command) note("command", f.command, 0, ROW.command);
    }
    col = 220;
    f.outcomes.forEach((e, i) => note("event", e, col + i * 220, ROW.event));
    [...f.systems.map((s) => ["system", s]), ...f.views.map((v) => ["query-model", v])].forEach(
      ([kind, text], i) => note(kind!, text!, col + i * 220, ROW.system)
    );
    x += 220 * (1 + Math.max(f.outcomes.length, f.systems.length + f.views.length, 1)) + 120;
    n++;
  }
  // Below the wall: the questions, the rules, the views apart.
  let i = 0;
  const below = (kind: string, text: string, row: number) =>
    b.shape("sticky-note", `b${i++}_${id(text)}`, (i % 12) * 240, row, {
      text,
      stickyNoteType: kind,
    });
  for (const m of model.modules) {
    m.questions.forEach((q) => below("hotspot", q, 1000));
    m.views.forEach((v) => below("query-model", v, 1260));
  }
  return b.done("event-storming.json");
}

/** A story as its Domain Storytelling board: actors, a work object per activity, numbered. */
function storyOf(t: BoardTemplates, s: ViewStory, k: number): ExportedBoard {
  const b = new Board(t, t.schema.story);
  const actors = [...new Set(s.steps.flatMap((x) => [x.actor, ...x.to]).filter(Boolean))];
  const at = new Map<string, { id: string; x: number; y: number }>();
  actors.forEach((a, i) => {
    const sid = `a${i}_${id(a)}`;
    const x = (i % 7) * 520;
    const y = i < 7 ? 0 : 1900;
    const kind = s.actorKinds[a];
    b.shape("actor", sid, x, y, {
      text: a,
      icon: kind === "system" ? "server" : kind === "group" ? "users" : "user",
    });
    at.set(a, { id: sid, x, y });
  });
  s.steps.forEach((st, i) => {
    const from = at.get(st.actor);
    if (!from) return;
    const to = st.to.length ? at.get(st.to[0]!) : undefined;
    const wo = `w${i}`;
    b.shape("work-object", wo, ((from.x + (to?.x ?? from.x)) / 2) | 0, 500 + (i % 4) * 330, {
      text: st.object || st.activity,
      icon: "file",
    });
    const act = `act${i}`;
    b.shape("arrow", act, 0, 0, { richText: rich(`${st.n}. ${st.activity}`) });
    b.bind(act, "start", from.id);
    b.bind(act, "end", wo);
    st.to.forEach((who, j) => {
      const target = at.get(who);
      if (!target) return;
      const tid = `to${i}_${j}`;
      b.shape("arrow", tid, 0, 0, { richText: rich("") });
      b.bind(tid, "start", wo);
      b.bind(tid, "end", target.id);
    });
  });
  s.comments.forEach((c, i) => b.shape("comment", `c${i}`, 2400, 1500 + i * 200, { text: c }));
  return b.done(`story-${k + 1}.json`);
}

/** The model's boards: a canvas per context with one, the flows' wall, a board per story. */
export function exportBoards(model: DomainView, t: BoardTemplates): ExportedBoard[] {
  const out: ExportedBoard[] = [];
  for (const m of model.modules) out.push(canvasOf(t, m));
  if (model.modules.some((m) => m.flows.length)) out.push(eventStormingOf(t, model));
  model.modules.flatMap((m) => m.stories).forEach((s, k) => out.push(storyOf(t, s, k)));
  return out;
}
