/**
 * A requirement's code drawn as standard UML (REQ-811, REQ-812), in Mermaid
 * that GitHub renders: a class diagram of the slice the requirement touches —
 * typed attributes and operations, visibility, stereotypes, associations and
 * dependencies — and a sequence diagram per scenario that follows the code
 * from the endpoint the scenario calls, object by object. Read from the code
 * alone: the same code gives the same text.
 */

import type { ScenarioSteps } from "./EvidenceDiagrams";
import { isMany, typeNames, type UmlMember, type UmlType } from "./UmlModel";

/** The look: black on white, as a modelling tool prints UML. */
export const UML_THEME = '%%{init: {"theme": "neutral"}}%%';

/** Mermaid ends a statement at `;` and reads `#`, `<`, `>` as markup: each written as an entity. */
const text = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[#;<>]/g, (ch) => ({ "#": "#35;", ";": "#59;", "<": "#lt;", ">": "#gt;" })[ch] as string);

/** A type as a class member writes it: generics with `~`, no quotes. */
const memberType = (t: string) => t.replace(/</g, "~").replace(/>/g, "~").replace(/"/g, "'").replace(/\s+/g, " ");

const STEREOTYPE: Record<UmlType["kind"], string> = {
  class: "",
  abstract: "abstract",
  interface: "interface",
  record: "record",
  enum: "enumeration",
};

function memberLine(m: UmlMember): string {
  const suffix = m.isStatic ? "$" : m.isAbstract ? "*" : "";
  if (m.kind === "field") return `${m.visibility}${m.name}${m.type ? " : " + memberType(m.type) : ""}${suffix}`;
  const params = m.params.map((p) => (p.type ? `${p.name} : ${memberType(p.type)}` : p.name)).join(", ");
  const ret = m.kind === "method" && m.type && m.type !== "void" ? " " + memberType(m.type) : "";
  return `${m.visibility}${m.name}(${params})${suffix}${ret}`;
}

export interface SliceChanges {
  /** Types that are not at the base. */
  readonly added: ReadonlySet<string>;
  /** Types whose members changed since the base: what was added and removed. */
  readonly changed: ReadonlyMap<string, { added: string[]; removed: string[] }>;
}

/** The members a change compares: each as its UML line. */
export const memberLines = (t: UmlType) => t.members.map(memberLine);

/**
 * The slice as a UML class diagram. Associations come from attributes,
 * dependencies from operation signatures, generalizations and realizations
 * from `extends` and `implements` — only between the types drawn.
 */
export function umlClassDiagram(types: ReadonlyArray<UmlType>, changes?: SliceChanges): string {
  const names = new Set(types.map((t) => t.name));
  const out = [UML_THEME, "classDiagram"];
  for (const t of types) {
    const lines = [
      ...(STEREOTYPE[t.kind] ? [`<<${STEREOTYPE[t.kind]}>>`] : []),
      ...t.literals,
      ...t.members.filter((m) => m.kind === "field").map(memberLine),
      ...t.members.filter((m) => m.kind !== "field").map(memberLine),
    ];
    if (lines.length === 0) out.push(`  class ${t.name}`);
    else out.push(`  class ${t.name} {`, ...lines.map((l) => `    ${l}`), "  }");
  }
  const seen = new Set<string>();
  const relate = (line: string) => {
    if (!seen.has(line)) {
      seen.add(line);
      out.push(`  ${line}`);
    }
  };
  for (const t of types) {
    for (const p of t.parents) {
      if (names.has(p.name)) relate(`${p.name} ${p.kind === "extends" ? "<|--" : "<|.."} ${t.name}`);
    }
  }
  const associated = new Set<string>();
  for (const t of types) {
    for (const f of t.members.filter((m) => m.kind === "field" && !m.isStatic)) {
      for (const n of typeNames(f.type).filter((n) => names.has(n) && n !== t.name)) {
        associated.add(`${t.name}>${n}`);
        relate(`${t.name} --> "${isMany(f.type) ? "0..*" : "1"}" ${n} : ${f.name}`);
      }
    }
  }
  for (const t of types) {
    for (const m of t.members.filter((x) => x.kind !== "field")) {
      const used = [m.type, ...m.params.map((p) => p.type)].flatMap(typeNames);
      for (const n of used.filter((n) => names.has(n) && n !== t.name)) {
        if (!associated.has(`${t.name}>${n}`)) relate(`${t.name} ..> ${n}`);
      }
    }
  }
  for (const n of changes?.added || []) {
    if (names.has(n)) out.push(`  style ${n} fill:#e6f4ea,stroke:#2f7a45,stroke-width:2px`);
  }
  for (const n of changes?.changed.keys() || []) {
    if (names.has(n)) out.push(`  style ${n} fill:#fff4d6,stroke:#b7791f,stroke-width:2px`);
  }
  return out.join("\n") + "\n";
}

// ── Sequences ────────────────────────────────────────────────────────────────

export interface Endpoint {
  readonly type: UmlType;
  readonly method: UmlMember;
  /** As the code declares it: `POST /api/orders/{id}`. */
  readonly route: string;
  /** The status its success answers, as `202 Accepted`. */
  readonly status: string;
}

const HTTP = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const STATUS: Record<string, string> = {
  OK: "200 OK",
  CREATED: "201 Created",
  ACCEPTED: "202 Accepted",
  NO_CONTENT: "204 No Content",
};

function annotationPath(annotations: string, name: string): string | null {
  const m = new RegExp(`@${name}\\b(?:\\s*\\(([^)]*)\\))?`).exec(annotations);
  if (!m) return null;
  const args = m[1] || "";
  const quoted = /(?:^|\b(?:value|path)\s*=\s*\{?\s*)"([^"]*)"/.exec(args.trim()) || /"([^"]*)"/.exec(args);
  return quoted ? quoted[1] : "";
}

const joinPath = (a: string, b: string) => `/${[a, b].join("/").split("/").filter(Boolean).join("/")}`;

/** The HTTP endpoints the code declares: Spring's mappings and JAX-RS's paths. */
export function endpointsOf(types: ReadonlyArray<UmlType>): Endpoint[] {
  const out: Endpoint[] = [];
  for (const t of types) {
    if (!/@(?:Rest)?Controller\b|@Path\b/.test(t.annotations)) continue;
    const base = annotationPath(t.annotations, "RequestMapping") ?? annotationPath(t.annotations, "Path") ?? "";
    for (const m of t.members.filter((x) => x.kind === "method")) {
      for (const verb of HTTP) {
        const springName = `${verb[0]}${verb.slice(1).toLowerCase()}Mapping`;
        let sub = annotationPath(m.annotations, springName);
        if (sub === null && new RegExp(`@${verb}\\b`).test(m.annotations)) sub = annotationPath(m.annotations, "Path") ?? "";
        if (
          sub === null &&
          new RegExp(`@RequestMapping\\b[^)]*RequestMethod\\.${verb}\\b`).test(m.annotations)
        ) {
          sub = annotationPath(m.annotations, "RequestMapping") ?? "";
        }
        if (sub === null) continue;
        const code = (/@ResponseStatus\s*\(\s*(?:code\s*=\s*|value\s*=\s*)?HttpStatus\.(\w+)/.exec(m.annotations) || [])[1];
        out.push({
          type: t,
          method: m,
          route: `${verb} ${joinPath(base, sub)}`,
          status: STATUS[code || (verb === "POST" && /Created/.test(m.type) ? "CREATED" : "OK")] || code,
        });
      }
    }
  }
  return out;
}

/** The endpoint a call reaches: `POST /api/orders/12` matches `POST /api/orders/{id}`. */
export function endpointFor(endpoints: ReadonlyArray<Endpoint>, call: string): Endpoint | null {
  const [verb, path] = call.split(/\s+/);
  for (const e of endpoints) {
    const [ev, ep] = e.route.split(" ");
    if (ev !== verb) continue;
    const pattern = ep.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^/]+\}/g, "[^/]+");
    if (new RegExp(`^${pattern}/?$`).test(path.replace(/[?#].*$/, ""))) return e;
  }
  return null;
}

interface Found {
  at: number;
  receiver: string;
  name: string;
  chain: string;
}

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "new", "throw", "super", "this", "synchronized"]);

/** The calls a body makes, in the order written: `x.m(` on a name, and `m(` on itself. */
function callsIn(body: string): Found[] {
  const src = body.replace(/\bthis\s*\.\s*/g, "");
  const out: Found[] = [];
  const re = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(|(?<![\w$.:])([a-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[3] && KEYWORDS.has(m[3])) continue;
    if (m[3] && /\bnew\s+$/.test(src.slice(Math.max(0, m.index - 5), m.index))) continue;
    // The chain that follows: `.user(…).call().entity(…)`.
    let end = src.indexOf("(", m.index + m[0].length - 1);
    let chain = `${m[2] || m[3]}()`;
    let close = closeParen(src, end);
    for (;;) {
      const next = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(close));
      if (!next) break;
      chain += `.${next[1]}()`;
      end = close + next[0].length - 1;
      close = closeParen(src, end);
    }
    out.push({ at: m.index, receiver: m[1] || "", name: m[2] || m[3], chain });
  }
  return out;
}

function closeParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === "(") depth += 1;
    else if (s[i] === ")" && --depth === 0) return i + 1;
  }
  return s.length;
}

function localTypes(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /\b([A-Z][\w$]*(?:<[^=;()]*>)?)\s+([a-z_$][\w$]*)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.set(m[2], m[1]);
  return out;
}

export interface CodeSequenceInput {
  readonly scenario: ScenarioSteps;
  readonly actor: string;
  readonly types: ReadonlyArray<UmlType>;
  /** What the web app calls, for a scenario that goes through a screen: `POST /api/x`. */
  readonly webCalls: ReadonlyArray<string>;
}

const STEP = /^(given|when|then|and|but)\b\s*/i;
const CALL = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s;,)"'`]*)/;
const MAX_DEPTH = 4;
/**
 * The platform's own value and utility types — a string, a date, a clock, a
 * list: their operations are how the code computes, not who it talks to, so
 * the sequence leaves them out.
 */
const PLATFORM = new Set([
  "String", "Integer", "Long", "Double", "Float", "Short", "Byte", "Boolean", "Character",
  "BigDecimal", "BigInteger", "Number", "Object", "Optional", "List", "Set", "Map", "Collection",
  "Stream", "Collectors", "Arrays", "Objects", "Math", "StringBuilder", "Pattern", "Matcher",
  "Instant", "LocalDate", "LocalDateTime", "LocalTime", "OffsetDateTime", "ZonedDateTime",
  "Duration", "Period", "Clock", "ZoneId", "ZoneOffset", "UUID", "Random",
  "string", "number", "boolean", "Array", "Promise", "Date", "JSON", "RegExp",
]);
/** `sql().param().param().update()` as `sql().param().update()`: a builder's repeats say nothing. */
const chainOf = (chain: string) => chain.split(".").filter((s, i, all) => s !== all[i - 1]).join(".");

/**
 * The scenario followed through the code, or null when its call reaches no
 * endpoint the code declares. A scenario whose WHEN names a call starts at
 * that endpoint; one that goes through a screen starts at the web app, which
 * calls the endpoint the requirement's web code names.
 */
export function codeSequence(input: CodeSequenceInput): string | null {
  const { scenario, actor, types } = input;
  const given: string[] = [];
  const when: string[] = [];
  const then: string[] = [];
  let kind = "given";
  for (const raw of scenario.steps) {
    const m = STEP.exec(raw.trim());
    const word = m ? m[1].toLowerCase() : "";
    if (word === "given" || word === "when" || word === "then") kind = word;
    const t = raw.trim().slice(m ? m[0].length : 0);
    if (t) (kind === "given" ? given : kind === "when" ? when : then).push(t);
  }
  const endpoints = endpointsOf(types);
  const direct = when.map((w) => CALL.exec(w)).find(Boolean);
  const viaWeb = !direct;
  const call = direct ? `${direct[1]} ${direct[2]}` : input.webCalls.find((c) => endpointFor(endpoints, c));
  const entry = call ? endpointFor(endpoints, call) : null;
  if (!entry || !call) return null;

  const byName = new Map(types.map((t) => [t.name, t]));
  const aliases = new Map<string, string>();
  const declared: string[] = [`  actor A as ${text(actor || "User")}`];
  const lifeline = (label: string) => {
    if (!aliases.has(label)) {
      const alias = `P${aliases.size + 1}`;
      aliases.set(label, alias);
      declared.push(`  participant ${alias} as ${text(label)}`);
    }
    return aliases.get(label) as string;
  };
  const lines: string[] = [];
  const web = viaWeb ? lifeline("«boundary» Web app") : "";
  const api = lifeline(`:${entry.type.name}`);

  const signature = (m: UmlMember) =>
    `${m.name}(${m.params.map((p) => (p.type ? `${p.name} : ${p.type}` : p.name)).join(", ")})`;
  const implementorOf = (iface: UmlType) => {
    const impl = types.filter((t) => t.parents.some((p) => p.kind === "implements" && p.name === iface.name));
    return impl.length === 1 ? impl[0] : null;
  };

  // A reply carries what the operation returns; a void one only ends the activation.
  const back = (from: string, to: string, type: string) =>
    lines.push(type && type !== "void" ? `  ${from}-->>-${to}: ${text(type)}` : `  deactivate ${from}`);

  // A scenario that ends in an error its THEN names — `422` and `idea_unclear` — follows the
  // exception the code throws with that code, where it is thrown, back to the actor.
  const outcome = then.join(" ");
  const failStatus = (/\b([45]\d\d)\b/.exec(outcome) || [])[1] || "";
  const failCode = (/`([a-z][a-z0-9_]*)`/.exec(outcome) || [])[1] || "";
  // Or, through a screen, the message the child reads: an exception whose constructor writes it.
  const quoted = (body: string) => [...body.matchAll(/"([^"\\]{2,})"/g)].map((q) => q[1]);
  const read = (q: string) => q.trim().length > 8 && outcome.includes(q.trim());
  const ownType =
    failStatus && failCode
      ? types.find((t) => t.members.some((m) => m.kind === "constructor" && m.body.includes(`"${failCode}"`)))
      : types.find((t) => t.members.some((m) => m.kind === "constructor" && quoted(m.body).some(read)));
  // Else a generic exception, found where it is thrown with the code or the message:
  // `throw new DomainException("too_many_photos", …, "Puedes adjuntar hasta " + MAX + " fotografías")`.
  const thrown = (body: string) =>
    [...body.matchAll(/(?:\bthrow\s+new|->\s*new)\s+([A-Z][\w$]*)\s*\(/g)].map((m) => {
      const end = body.indexOf(";", m.index);
      return { at: m.index as number, type: m[1], stmt: body.slice(m.index, end < 0 ? undefined : end) };
    });
  const matches = (stmt: string) =>
    failStatus && failCode ? stmt.includes(`"${failCode}"`) : quoted(stmt).some(read);
  const site = ownType
    ? undefined
    : types
        .flatMap((t) => t.members)
        .flatMap((m) => thrown(m.body || ""))
        .find((s) => matches(s.stmt));
  const failure = ownType ? { name: ownType.name } : site ? { name: site.type } : null;
  const siteCode = site ? quoted(site.stmt).find((q) => /^[a-z][a-z0-9_]*$/.test(q)) || "" : "";
  const failLabel = failStatus
    ? `${failStatus} ${failCode}`
    : ownType
      ? quoted(ownType.members.find((m) => m.kind === "constructor")?.body || "")[0] || ownType.name
      : siteCode || site?.type || "";
  const raise = (from: string, to: string) => {
    const what = siteCode ? `${failure!.name}(${siteCode})` : failure!.name;
    lines.push(`  ${from}--x${to}: ${text(`«exception» ${what}`)}`);
    lines.push(`  deactivate ${from}`);
  };
  /** Where a method throws the scenario's exception; -1 when it does not. */
  const throwIn = (body: string) => {
    if (!failure) return -1;
    const at = thrown(body).find((s) => s.type === failure.name && (!site || matches(s.stmt)));
    return at ? at.at : -1;
  };

  /** Draws the calls a method makes; true when it ends in the scenario's exception. */
  const visit = (owner: UmlType, method: UmlMember, from: string, depth: number, stack: string[]): boolean => {
    const fields = new Map(owner.members.filter((m) => m.kind === "field").map((m) => [m.name, m.type]));
    const params = new Map(method.params.map((p) => [p.name, p.type]));
    const locals = localTypes(method.body);
    const body = method.body.replace(/\bthis\s*\.\s*/g, "");
    const throwAt = throwIn(body);
    for (const c of callsIn(method.body)) {
      if (throwAt >= 0 && c.at > throwAt) break;
      if (!c.receiver) {
        const self = owner.members.find((m) => m.kind === "method" && m.name === c.name);
        if (!self) continue;
        const key = `${owner.name}.${self.name}`;
        if (stack.includes(key)) continue;
        const call = lines.push(`  ${from}->>+${from}: ${text(signature(self))}`);
        if (depth < MAX_DEPTH && visit(owner, self, from, depth + 1, [...stack, key])) {
          raise(from, from);
          return true;
        }
        if (self.visibility === "-" && lines.length === call && !/\bthrow\b/.test(self.body)) {
          lines.pop();
          continue;
        }
        back(from, from, self.type);
        continue;
      }
      const declaredType = params.get(c.receiver) ?? locals.get(c.receiver) ?? fields.get(c.receiver);
      if (declaredType && PLATFORM.has(typeNames(declaredType)[0] ?? "")) continue;
      // `Incident.checkPhotos(…)`: a class's static operation, on the class's own lifeline.
      const statics = declaredType ? undefined : byName.get(c.receiver);
      if (!declaredType && !statics) continue;
      const target = statics || typeNames(declaredType as string).map((n) => byName.get(n)).find(Boolean);
      if (target) {
        if (!statics && (target.kind === "record" || target.kind === "enum")) continue;
        const runtime = target.kind === "interface" ? implementorOf(target) || target : target;
        const callee =
          runtime.members.find((m) => m.kind === "method" && m.name === c.name) ||
          target.members.find((m) => m.kind === "method" && m.name === c.name);
        if (!callee) continue;
        const to = lifeline(statics ? runtime.name : `:${runtime.name}`);
        const key = `${runtime.name}.${callee.name}`;
        lines.push(`  ${from}->>+${to}: ${text(signature(callee))}`);
        if (depth < MAX_DEPTH && !stack.includes(key) && callee.body && visit(runtime, callee, to, depth + 1, [...stack, key])) {
          raise(to, from);
          return true;
        }
        back(to, from, callee.type);
      } else if (fields.has(c.receiver) && !params.has(c.receiver) && !locals.has(c.receiver)) {
        // A collaborator outside the project — a client, a repository — drawn, not entered.
        const to = lifeline(`:${typeNames(declaredType as string)[0]}`);
        lines.push(`  ${from}->>+${to}: ${text(chainOf(c.chain))}`);
        back(to, from, "");
      }
    }
    return throwAt >= 0;
  };

  const route = entry.route;
  if (viaWeb) {
    lines.push(`  A->>+${web}: ${text(when.join("; "))}`);
    lines.push(`  ${web}->>+${api}: ${text(route)}`);
  } else {
    lines.push(`  A->>+${api}: ${text(route)}`);
  }
  const threw = visit(entry.type, entry.method, api, 1, [`${entry.type.name}.${entry.method.name}`]);
  const status = threw ? failLabel : entry.status;
  if (viaWeb) {
    lines.push(`  ${api}-->>-${web}: ${text(status)}`);
    lines.push(`  ${web}-->>-A: ${text(then.join("; "))}`);
  } else {
    lines.push(`  ${api}-->>-A: ${text(status)}`);
  }
  const first = viaWeb ? web : api;
  const notes = [
    ...(given.length ? [`  Note over A,${first}: ${text(given.join("; "))}`] : []),
  ];
  const result = !viaWeb && then.length ? [`  Note over A,${api}: ${text(then.join("; "))}`] : [];
  return (
    [
      UML_THEME,
      "sequenceDiagram",
      `  title ${text(scenario.title)}`,
      "  autonumber",
      ...declared,
      ...notes,
      ...lines,
      ...result,
    ].join("\n") + "\n"
  );
}

const PATH = /["'`](\/api\/[^"'`$]*)/;
const METHOD = /method\s*:\s*["'`](\w+)["'`]/;

/**
 * The `METHOD /path` calls a web file makes: the first after each line that
 * names the requirement, or all of them. The method is the one written with
 * the call, up to the next call; else the one the helper it goes through
 * sends with (`send("/api/x", form)` and `function send` posting); else GET.
 */
export function webCallsOf(source: string, id: string): string[] {
  const lines = source.split(/\r?\n/);
  const helperVerb = (name: string) => {
    const at = source.search(new RegExp(`function\\s+${name}\\b`));
    return at < 0 ? "" : (METHOD.exec(source.slice(at, at + 1500)) || [])[1] || "";
  };
  const all: Array<{ line: number; call: string }> = [];
  lines.forEach((l, i) => {
    const path = PATH.exec(l);
    if (!path) return;
    const own: string[] = [l];
    for (let j = i + 1; j < Math.min(lines.length, i + 4) && !PATH.test(lines[j]); j += 1) own.push(lines[j]);
    const helper = (/([A-Za-z_$][\w$]*)\s*(?:<[^>()]*>)?\s*\(\s*["'`]\/api\//.exec(l) || [])[1];
    const verb = (METHOD.exec(own.join(" ")) || [])[1] || (helper ? helperVerb(helper) : "") || "GET";
    all.push({ line: i, call: `${verb.toUpperCase()} ${path[1]}` });
  });
  const named = lines.map((l, i) => (l.includes(id) ? i : -1)).filter((i) => i >= 0);
  const close = named
    .map((n) => all.find((c) => c.line >= n && c.line - n <= 3))
    .filter((c): c is { line: number; call: string } => c !== undefined);
  return [...new Set((close.length ? close : all).map((c) => c.call))];
}
