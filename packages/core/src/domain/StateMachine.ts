/**
 * An entity's state machine (REQ-637): one file per entity,
 * `docs/specs/state-machines/<Entity>.md`, read and checked; changed only by a
 * change's delta, applied at archive (REQ-638); drawn as PlantUML (REQ-639).
 *
 *   # GenerationRequest — states
 *
 *   ## States
 *   - Received (initial) — entry / record
 *   - Validating — do / guardrails
 *   - Available (final) — entry / show to the child
 *
 *   ## Transitions
 *   | From | To | Trigger | Requirement |
 *   |---|---|---|---|
 *   | Received | Validating | validate [safe] / reserve | REQ-011 |
 *
 *   ## Forbidden
 *   - Rejected → Available (REQ-034)
 *
 * A transition is known by its states and its event — the trigger's words
 * before a `[guard]` or a `/ action` — so a delta can change its guard, action
 * or requirements. Pure: strings in, findings and Markdown out.
 */

export interface MachineState {
  name: string;
  initial: boolean;
  final: boolean;
  /** `entry / …`, `do / …`: what the state does; "" when nothing. */
  behaviour: string;
}

export interface MachineTransition {
  from: string;
  to: string;
  /** `event [guard] / action`, as written. */
  trigger: string;
  requirements: string[];
  line: number;
}

export interface ForbiddenTransition {
  from: string;
  to: string;
  requirement: string | null;
  line: number;
}

export interface StateMachine {
  name: string;
  states: MachineState[];
  transitions: MachineTransition[];
  forbidden: ForbiddenTransition[];
}

export interface MachineFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
  target?: string;
  line?: number;
  fix: string;
}

const REQ = /REQ-\d+/g;

function sections(text: string): Map<string, Array<{ text: string; line: number }>> {
  const out = new Map<string, Array<{ text: string; line: number }>>();
  let current: Array<{ text: string; line: number }> | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const h = /^##\s+(.+?)\s*$/.exec(raw);
    if (h) {
      current = [];
      out.set(h[1]!.toLowerCase(), current);
      return;
    }
    if (current && raw.trim()) current.push({ text: raw, line: i + 1 });
  });
  return out;
}

function titleName(text: string): string {
  const m = /^#\s+(?:Delta\s*[—-]\s*)?(.+?)(?:\s*[—-]\s*states)?\s*$/im.exec(text);
  return m ? m[1]!.trim() : "";
}

function stateOf(item: string): MachineState | null {
  const m = /^\s*[-*]\s+(.+?)\s*$/.exec(item);
  if (!m) return null;
  const [head, ...rest] = m[1]!.split(/\s+[—–]\s+/);
  const flags = /\(([^)]*)\)\s*$/.exec(head!);
  const name = (flags ? head!.slice(0, flags.index) : head!).trim();
  const words = (flags?.[1] ?? "").toLowerCase();
  return {
    name,
    initial: /\binitial\b/.test(words),
    final: /\bfinal\b/.test(words),
    behaviour: rest.join(" — ").trim(),
  };
}

function rowsOf(items: Array<{ text: string; line: number }>): MachineTransition[] {
  const out: MachineTransition[] = [];
  for (const { text, line } of items) {
    if (!text.trim().startsWith("|")) continue;
    const cells = text
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c)) || cells[0]!.toLowerCase() === "from") continue;
    out.push({
      from: cells[0] ?? "",
      to: cells[1] ?? "",
      trigger: cells[2] ?? "",
      requirements: (cells[3] ?? "").match(REQ) ?? [],
      line,
    });
  }
  return out;
}

function forbiddenOf(items: Array<{ text: string; line: number }>): ForbiddenTransition[] {
  const out: ForbiddenTransition[] = [];
  for (const { text, line } of items) {
    const m = /^\s*[-*]\s+(.+?)\s*(?:→|->)\s*(.+?)\s*(?:\((REQ-\d+)\))?\s*$/.exec(text);
    if (m) out.push({ from: m[1]!.trim(), to: m[2]!.trim(), requirement: m[3] ?? null, line });
  }
  return out;
}

export function parseStateMachine(text: string): StateMachine {
  const s = sections(text);
  return {
    name: titleName(text),
    states: (s.get("states") ?? [])
      .map((i) => stateOf(i.text))
      .filter((x): x is MachineState => !!x),
    transitions: rowsOf(s.get("transitions") ?? []),
    forbidden: forbiddenOf(s.get("forbidden") ?? []),
  };
}

/** The words of a trigger before its guard or action: what names the transition. */
export function eventOf(trigger: string): string {
  return trigger.split(/[[/]/)[0]!.trim().toLowerCase();
}

const keyOf = (t: { from: string; to: string; trigger: string }) =>
  `${t.from}\u0000${t.to}\u0000${eventOf(t.trigger)}`;

export function checkStateMachine(
  m: StateMachine,
  requirements: ReadonlySet<string>
): MachineFinding[] {
  const out: MachineFinding[] = [];
  const err = (code: string, message: string, fix: string, target?: string, line?: number) =>
    out.push({
      code,
      severity: "error",
      message,
      fix,
      ...(target ? { target } : {}),
      ...(line ? { line } : {}),
    });
  const warn = (code: string, message: string, fix: string, target?: string, line?: number) =>
    out.push({
      code,
      severity: "warning",
      message,
      fix,
      ...(target ? { target } : {}),
      ...(line ? { line } : {}),
    });
  if (m.states.length === 0) {
    err(
      "sm_no_states",
      `${m.name || "The machine"} lists no states.`,
      "List its states under `## States`, one `- Name` per line."
    );
    return out;
  }
  const names = new Set<string>();
  for (const st of m.states) {
    if (names.has(st.name))
      err("sm_duplicate_state", `${st.name} is listed twice.`, "Keep one line per state.", st.name);
    names.add(st.name);
  }
  const initial = m.states.filter((s) => s.initial);
  if (initial.length === 0)
    err(
      "sm_no_initial",
      `${m.name} has no initial state.`,
      "Mark the state it starts in: `- Name (initial)`."
    );
  if (initial.length > 1)
    err(
      "sm_many_initial",
      `${m.name} starts in ${initial.map((s) => s.name).join(" and ")}.`,
      "Mark one state `(initial)`."
    );
  const forbidden = new Map(m.forbidden.map((f) => [`${f.from}\u0000${f.to}`, f]));
  for (const t of m.transitions) {
    for (const end of [t.from, t.to])
      if (!names.has(end))
        err(
          "sm_unknown_state",
          `The transition ${t.from} → ${t.to} names ${end}, which is no state of ${m.name}.`,
          `List ${end} under \`## States\`, or correct the name.`,
          end,
          t.line
        );
    for (const r of t.requirements)
      if (!requirements.has(r))
        err(
          "sm_unknown_requirement",
          `The transition ${t.from} → ${t.to} names ${r}, which is no requirement.`,
          `Name the requirement that asks for this transition.`,
          r,
          t.line
        );
    if (t.requirements.length === 0)
      warn(
        "sm_transition_untraced",
        `No requirement asks for ${t.from} → ${t.to} (${t.trigger}).`,
        "Name the requirement that asks for it in its Requirement cell.",
        `${t.from} → ${t.to}`,
        t.line
      );
    const no = forbidden.get(`${t.from}\u0000${t.to}`);
    if (no)
      err(
        "sm_forbidden_used",
        `${t.from} → ${t.to} is forbidden${no.requirement ? ` (${no.requirement})` : ""}, yet it is a transition.`,
        "Remove the transition, or the rule that forbids it.",
        `${t.from} → ${t.to}`,
        t.line
      );
  }
  for (const f of m.forbidden)
    for (const end of [f.from, f.to])
      if (!names.has(end))
        err(
          "sm_unknown_state",
          `The forbidden ${f.from} → ${f.to} names ${end}, which is no state of ${m.name}.`,
          `Correct the name.`,
          end,
          f.line
        );
  // Reached from the initial state, following the transitions.
  if (initial.length === 1) {
    const seen = new Set([initial[0]!.name]);
    const queue = [initial[0]!.name];
    while (queue.length) {
      const at = queue.shift()!;
      for (const t of m.transitions)
        if (t.from === at && !seen.has(t.to)) (seen.add(t.to), queue.push(t.to));
    }
    for (const st of m.states)
      if (!seen.has(st.name))
        warn(
          "sm_unreachable",
          `No transition from ${initial[0]!.name} reaches ${st.name}.`,
          `Add the transition into ${st.name}, or remove it.`,
          st.name
        );
  }
  for (const st of m.states)
    if (!st.final && !m.transitions.some((t) => t.from === st.name))
      warn(
        "sm_dead_end",
        `${st.name} has no way out and is not final.`,
        `Add a transition out of ${st.name}, or mark it \`(final)\`.`,
        st.name
      );
  return out;
}

export function renderStateMachine(m: StateMachine): string {
  const lines = [`# ${m.name} — states`, "", "## States", ""];
  for (const s of m.states) {
    const flags = [s.initial && "initial", s.final && "final"].filter(Boolean).join(", ");
    lines.push(`- ${s.name}${flags ? ` (${flags})` : ""}${s.behaviour ? ` — ${s.behaviour}` : ""}`);
  }
  lines.push(
    "",
    "## Transitions",
    "",
    "| From | To | Trigger | Requirement |",
    "|---|---|---|---|"
  );
  for (const t of m.transitions)
    lines.push(`| ${t.from} | ${t.to} | ${t.trigger} | ${t.requirements.join(", ") || "-"} |`);
  if (m.forbidden.length) {
    lines.push("", "## Forbidden", "");
    for (const f of m.forbidden)
      lines.push(`- ${f.from} → ${f.to}${f.requirement ? ` (${f.requirement})` : ""}`);
  }
  return lines.join("\n") + "\n";
}

export interface StateMachineDelta {
  name: string;
  added: {
    states: MachineState[];
    transitions: MachineTransition[];
    forbidden: ForbiddenTransition[];
  };
  modified: { states: MachineState[]; transitions: MachineTransition[] };
  removed: {
    states: MachineState[];
    transitions: MachineTransition[];
    forbidden: ForbiddenTransition[];
  };
}

export function parseStateMachineDelta(text: string): StateMachineDelta {
  const s = sections(text);
  const states = (k: string) =>
    (s.get(k) ?? []).map((i) => stateOf(i.text)).filter((x): x is MachineState => !!x);
  return {
    name: titleName(text),
    added: {
      states: states("added states"),
      transitions: rowsOf(s.get("added transitions") ?? []),
      forbidden: forbiddenOf(s.get("added forbidden") ?? []),
    },
    modified: {
      states: states("modified states"),
      transitions: rowsOf(s.get("modified transitions") ?? []),
    },
    removed: {
      states: states("removed states"),
      transitions: rowsOf(s.get("removed transitions") ?? []),
      forbidden: forbiddenOf(s.get("removed forbidden") ?? []),
    },
  };
}

/**
 * What a delta cannot do to the machine it changes (REQ-638): add what is
 * there, change or remove what is not, remove a state transitions still use.
 * A requirement no transition names any more is warned, not refused.
 */
export function checkStateMachineDelta(
  d: StateMachineDelta,
  base: StateMachine | null,
  /** When given, a transition the delta writes must name requirements in it. */
  requirements?: ReadonlySet<string>
): MachineFinding[] {
  const out: MachineFinding[] = [];
  if (requirements)
    for (const t of [...d.added.transitions, ...d.modified.transitions])
      for (const r of t.requirements)
        if (!requirements.has(r))
          out.push({
            code: "sm_unknown_requirement",
            severity: "error",
            message: `The transition ${t.from} → ${t.to} names ${r}, which is no requirement.`,
            fix: "Name the requirement that asks for this transition.",
            target: r,
            line: t.line,
          });
  const states = new Set((base?.states ?? []).map((s) => s.name));
  const keys = new Set((base?.transitions ?? []).map(keyOf));
  const err = (code: string, message: string, fix: string, target: string, line?: number) =>
    out.push({ code, severity: "error", message, fix, target, ...(line ? { line } : {}) });
  for (const s of d.added.states)
    if (states.has(s.name))
      err(
        "sm_state_exists",
        `${d.name} already has ${s.name}.`,
        "Move it under `## MODIFIED States`.",
        s.name
      );
  for (const s of [...d.modified.states, ...d.removed.states])
    if (!states.has(s.name))
      err(
        "sm_state_unknown",
        `${d.name} has no state ${s.name}.`,
        "Correct the name, or add it under `## ADDED States`.",
        s.name
      );
  for (const t of d.added.transitions)
    if (keys.has(keyOf(t)))
      err(
        "sm_transition_exists",
        `${t.from} → ${t.to} (${eventOf(t.trigger)}) is already a transition.`,
        "Move it under `## MODIFIED Transitions`.",
        `${t.from} → ${t.to}`,
        t.line
      );
  for (const t of [...d.modified.transitions, ...d.removed.transitions])
    if (!keys.has(keyOf(t)))
      err(
        "sm_transition_unknown",
        `${d.name} has no transition ${t.from} → ${t.to} on "${eventOf(t.trigger)}".`,
        "Name it as it is: its states and the words of its trigger before any [guard] or / action.",
        `${t.from} → ${t.to}`,
        t.line
      );
  const after = base ? applyToModel(base, d) : applyToModel(empty(d.name), d);
  for (const s of d.removed.states) {
    const using = after.transitions.filter((t) => t.from === s.name || t.to === s.name);
    if (states.has(s.name) && using.length)
      err(
        "sm_state_in_use",
        `${s.name} cannot go: ${using.map((t) => `${t.from} → ${t.to}`).join(", ")} still use it.`,
        `Remove or move those transitions in the same delta.`,
        s.name
      );
  }
  const named = new Set(after.transitions.flatMap((t) => t.requirements));
  for (const r of new Set(d.removed.transitions.flatMap((t) => t.requirements)))
    if (!named.has(r) && (base?.transitions ?? []).some((t) => t.requirements.includes(r)))
      out.push({
        code: "sm_requirement_uncovered",
        severity: "warning",
        message: `After this change no transition of ${d.name} names ${r}.`,
        fix: `If ${r} still asks for a transition, name it; otherwise modify or remove ${r} in the change.`,
        target: r,
      });
  return out;
}

const empty = (name: string): StateMachine => ({
  name,
  states: [],
  transitions: [],
  forbidden: [],
});

function applyToModel(base: StateMachine, d: StateMachineDelta): StateMachine {
  const removedStates = new Set(d.removed.states.map((s) => s.name));
  const modStates = new Map(d.modified.states.map((s) => [s.name, s]));
  const removedKeys = new Set(d.removed.transitions.map(keyOf));
  const modKeys = new Map(d.modified.transitions.map((t) => [keyOf(t), t]));
  const removedForbidden = new Set(d.removed.forbidden.map((f) => `${f.from}\u0000${f.to}`));
  return {
    name: base.name || d.name,
    states: [
      ...base.states
        .filter((s) => !removedStates.has(s.name))
        .map((s) => modStates.get(s.name) ?? s),
      ...d.added.states,
    ],
    transitions: [
      ...base.transitions
        .filter((t) => !removedKeys.has(keyOf(t)))
        .map((t) => modKeys.get(keyOf(t)) ?? t),
      ...d.added.transitions,
    ],
    forbidden: [
      ...base.forbidden.filter((f) => !removedForbidden.has(`${f.from}\u0000${f.to}`)),
      ...d.added.forbidden,
    ],
  };
}

/** The machine after the delta, as Markdown; null when no state is left. */
export function applyStateMachineDelta(
  base: StateMachine | null,
  d: StateMachineDelta
): string | null {
  const after = applyToModel(base ?? empty(d.name), d);
  return after.states.length ? renderStateMachine(after) : null;
}

const alias = (name: string) => name.normalize("NFD").replace(/[^\w]/g, "_");

/** The machine as PlantUML (REQ-639): what any UML tool can open. */
export function renderStateMachinePuml(m: StateMachine): string {
  const lines = [`@startuml ${alias(m.name)}`, `title ${m.name}`, "hide empty description"];
  for (const s of m.states)
    lines.push(`state "${s.name}" as ${alias(s.name)}${s.behaviour ? ` : ${s.behaviour}` : ""}`);
  for (const s of m.states.filter((x) => x.initial)) lines.push(`[*] --> ${alias(s.name)}`);
  for (const t of m.transitions)
    lines.push(
      `${alias(t.from)} --> ${alias(t.to)} : ${t.trigger}${t.requirements.length ? `\\n${t.requirements.join(", ")}` : ""}`
    );
  for (const s of m.states.filter((x) => x.final)) lines.push(`${alias(s.name)} --> [*]`);
  if (m.forbidden.length) {
    lines.push("note as Forbidden", "  <<constraint>> Forbidden");
    for (const f of m.forbidden)
      lines.push(`  ${f.from} → ${f.to}${f.requirement ? ` (${f.requirement})` : ""}`);
    lines.push("end note");
  }
  lines.push("@enduml");
  return lines.join("\n") + "\n";
}
