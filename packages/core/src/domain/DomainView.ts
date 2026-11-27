/**
 * The project's domain model, to draw (brief-domain-views REQ-658): its
 * bounded contexts with their integrations, flows and stories — read from a
 * DDD workshop's models (docs/brief/models/*.yaml), or, with no workshop, from
 * the specification: each module a context, each requirement a flow, each use
 * case's main flow a story. Pure: texts in, the model out.
 */
// The project's own YAML reader: js-yaml is a dev dependency, not shipped (found by the E2E journey).
import { parseYamlLite } from "./YamlLite";
import { parseTraceComment, type TraceComment } from "./SpecParser";

export interface ViewFlow {
  actor: string | null;
  command: string | null;
  policy: string | null;
  trigger: string | null;
  outcomes: string[];
  systems: string[];
  views: string[];
  /** "receives <command>", "sends <event>", "assumed", or "spec" for a requirement. */
  placed: string;
  /** The requirement it is, when read from the specification. */
  requirement?: string;
}

export interface ViewStep {
  n: number;
  actor: string;
  activity: string;
  object: string;
  to: string[];
}

export interface ViewStory {
  title: string;
  primaryActor: string | null;
  /** person, group or system, by name. */
  actorKinds: Record<string, string>;
  steps: ViewStep[];
  comments: string[];
}

export interface ViewIntegration {
  direction: "inbound" | "outbound";
  with: string;
  kind: string;
  relationship: string | null;
  messages: Array<{ type: string; label: string }>;
}

export interface ViewModule {
  slug: string;
  name: string;
  purpose: string;
  classification: { domain: string | null; businessModel: string | null; evolution: string | null };
  roles: string[];
  integrations: ViewIntegration[];
  terms: Array<{ term: string; definition: string }>;
  rules: string[];
  flows: ViewFlow[];
  stories: ViewStory[];
  views: string[];
  questions: string[];
  assumptions: string;
  metrics: string;
}

export interface DomainView {
  source: "workshop" | "spec";
  modules: ViewModule[];
}

const str = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((x): x is string => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** A context of the workshop, from its `docs/brief/models/<context>.yaml`. */
export function moduleFromYaml(text: string): ViewModule {
  const d = obj(parseYamlLite(text));
  const cls = obj(d.classification);
  const integrations = (Array.isArray(d.integrations) ? d.integrations : []).map((x) => {
    const i = obj(x);
    return {
      direction: i.direction === "outbound" ? "outbound" : "inbound",
      with: str(i.with) ?? "",
      kind: str(i.kind) ?? "",
      relationship: str(i.relationship),
      messages: (Array.isArray(i.messages) ? i.messages : []).map((m) => {
        const [type, label] = Object.entries(obj(m))[0] ?? ["", ""];
        return { type, label: str(label) ?? "" };
      }),
    } as ViewIntegration;
  });
  const flows = (Array.isArray(d.flows) ? d.flows : []).map((x) => {
    const f = obj(x);
    return {
      actor: str(f.actor),
      command: str(f.command),
      policy: str(f.policy),
      trigger: str(f.when),
      outcomes: strs(f.outcomes),
      systems: strs(f.systems),
      views: strs(f.views),
      placed: str(f.placed) ?? "assumed",
    };
  });
  const stories = (Array.isArray(d.stories) ? d.stories : []).map((x, i) => {
    const s = obj(x);
    const steps = (Array.isArray(s.steps) ? s.steps : []).map((y) => {
      const st = obj(y);
      return {
        n: Number(st.n) || 0,
        actor: str(st.actor) ?? "",
        activity: str(st.activity) ?? "",
        object: str(st.object) ?? "",
        to: strs(st.to),
      };
    });
    const actorKinds: Record<string, string> = {};
    for (const a of Array.isArray(s.actors) ? s.actors : [])
      for (const [name, kind] of Object.entries(obj(a))) actorKinds[name] = str(kind) ?? "person";
    return {
      title: str(s.title) ?? `Story ${i + 1}`,
      primaryActor: str(s.primary_actor),
      actorKinds,
      steps,
      comments: strs(s.comments),
    };
  });
  return {
    slug: str(d.slug) ?? "",
    name: str(d.context) ?? str(d.slug) ?? "",
    purpose: str(d.purpose) ?? "",
    classification: {
      domain: str(cls.domain),
      businessModel: str(cls.business_model),
      evolution: str(cls.evolution),
    },
    roles: strs(d.roles),
    integrations,
    terms: (Array.isArray(d.terms) ? d.terms : []).map((x) => {
      const t = obj(x);
      return { term: str(t.term) ?? "", definition: str(t.definition) ?? "" };
    }),
    rules: strs(d.rules),
    flows,
    stories,
    views: strs(d.views),
    questions: strs(d.questions),
    assumptions: str(d.assumptions) ?? "",
    metrics: str(d.metrics) ?? "",
  };
}

/** A requirement as the specification writes it: what the model needs of it. */
export interface SpecRequirement {
  id: string;
  title: string;
  module: string;
  actor: string | null;
  scenarios: string[];
}

/** A use case with a specification: its main flow, step by step. */
export interface SpecUseCase {
  id: string;
  name: string;
  actor: string | null;
  module: string | null;
  steps: Array<{ actor: string; text: string }>;
}

/**
 * A block's first trace, read as the spec parser reads it (REQ-798): its own
 * pattern took `actor="Adulto responsable"` for `"Adulto`. Found by index —
 * a regex for the end of a comment is what CodeQL flags (see SpecParser).
 */
function traceOf(block: string): TraceComment | null {
  const at = block.indexOf("specgate:trace");
  if (at < 0) return null;
  const end = block.indexOf("-->", at);
  const start = block.lastIndexOf("<!--", at);
  return parseTraceComment(block.slice(start < 0 ? at : start, end < 0 ? undefined : end + 3));
}

/** A capability's or a delta's requirements: their id, title, trace actor and scenarios. */
export function requirementsOf(spec: string, module: string): SpecRequirement[] {
  const out: SpecRequirement[] = [];
  for (const block of spec.split(/\n(?=### Requirement: )/)) {
    const m = /^### Requirement: (REQ-\d+)\s+[—-]\s+(.+)$/m.exec(block);
    if (!m) continue;
    const actor = traceOf(block)?.actor ?? null;
    const scenarios = [...block.matchAll(/^#### Scenario: (?:SCN-[\w]+\s+[—-]\s+)?(.+)$/gm)].map(
      (s) => s[1]!.trim()
    );
    out.push({ id: m[1]!, title: m[2]!.trim(), module, actor, scenarios });
  }
  return out;
}

/** The model the specification gives, with no workshop: a context per module. */
export function modelFromSpec(input: {
  requirements: readonly SpecRequirement[];
  useCases: readonly SpecUseCase[];
}): DomainView {
  const byModule = new Map<string, ViewModule>();
  const moduleOf = (slug: string) => {
    let m = byModule.get(slug);
    if (!m) {
      m = {
        slug,
        name: slug,
        purpose: "",
        classification: { domain: null, businessModel: null, evolution: null },
        roles: [],
        integrations: [],
        terms: [],
        rules: [],
        flows: [],
        stories: [],
        views: [],
        questions: [],
        assumptions: "",
        metrics: "",
      };
      byModule.set(slug, m);
    }
    return m;
  };
  for (const r of input.requirements)
    moduleOf(r.module).flows.push({
      actor: r.actor,
      command: r.title,
      policy: null,
      trigger: null,
      outcomes: [...r.scenarios],
      systems: [],
      views: [],
      placed: "spec",
      requirement: r.id,
    });
  const first = [...byModule.keys()][0] ?? "dominio";
  for (const u of input.useCases)
    moduleOf(u.module ?? first).stories.push({
      title: `${u.id} ${u.name}`,
      primaryActor: u.actor,
      actorKinds: {},
      steps: u.steps.map((s, i) => ({
        n: i + 1,
        actor: s.actor || u.actor || "",
        activity: s.text,
        object: "",
        to: [],
      })),
      comments: [],
    });
  return { source: "spec", modules: [...byModule.values()] };
}
