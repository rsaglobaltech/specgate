/**
 * The lessons that keep coming back (REQ-684): review notes alike in several
 * changes, and stages of the gate the agent keeps failing — phase 4 of the
 * trust curve, from error to barrier. Pure: the command reads the notes and
 * the harness events.
 */

export interface NoteRef {
  change: string;
  date: string;
  requirement: string | null;
  text: string;
}

export interface GateFailure {
  req: string;
  attempt: number;
  stage: string;
}

export interface Lesson {
  id: string;
  kind: "review" | "harness";
  count: number;
  /** The notes, for a `review` lesson. */
  evidence?: NoteRef[];
  /** The stage and the requirements, for a `harness` lesson. */
  stage?: string;
  requirements?: string[];
  next: string;
}

/** Two notes are alike when they share this much of the shorter one's significant words. */
export const ALIKE = 0.6;

/** Lower case, accents folded, four letters or more, a plural `s` dropped. */
export function significantWords(text: string): Set<string> {
  const words = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
  return new Set(words);
}

export function alike(a: string, b: string): boolean {
  const x = significantWords(a);
  const y = significantWords(b);
  const smaller = Math.min(x.size, y.size);
  if (smaller === 0) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / smaller >= ALIKE;
}

/** The lessons, from the most repeated; `L1`, `L2`… */
export function lessonsOf(notes: readonly NoteRef[], failures: readonly GateFailure[]): Lesson[] {
  // Review notes: groups of alike notes, from two changes or more.
  const parent = notes.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      if (alike(notes[i].text, notes[j].text)) parent[root(j)] = root(i);
    }
  }
  const groups = new Map<number, NoteRef[]>();
  notes.forEach((n, i) => groups.set(root(i), [...(groups.get(root(i)) || []), n]));
  const found: Array<Omit<Lesson, "id" | "next">> = [];
  for (const g of groups.values()) {
    if (new Set(g.map((n) => n.change)).size < 2) continue;
    found.push({
      kind: "review",
      count: g.length,
      evidence: [...g].sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  // The harness: a stage failed in three attempts or more, over two requirements or more.
  const byStage = new Map<string, Set<string>>();
  const reqsByStage = new Map<string, Set<string>>();
  for (const f of failures) {
    byStage.set(f.stage, (byStage.get(f.stage) || new Set()).add(`${f.req}#${f.attempt}`));
    reqsByStage.set(f.stage, (reqsByStage.get(f.stage) || new Set()).add(f.req));
  }
  for (const [stage, attempts] of byStage) {
    const reqs = [...(reqsByStage.get(stage) || [])].sort();
    if (attempts.size >= 3 && reqs.length >= 2) {
      found.push({ kind: "harness", count: attempts.size, stage, requirements: reqs });
    }
  }

  return found
    .sort((a, b) => b.count - a.count || (a.kind === b.kind ? 0 : a.kind === "review" ? -1 : 1))
    .map((l, i) => ({
      id: `L${i + 1}`,
      ...l,
      next: `specgate learn promote L${i + 1} --title "<rule>"`,
    }));
}

/** A rule's title as a change id: `learn-prices-carry-their-currency`. */
export function learnChangeId(title: string): string {
  const slug = String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return `learn-${slug || "rule"}`;
}

export interface LearnedRule {
  title: string;
  forbid?: string;
  in?: string;
  run?: string;
  level?: "warn";
  /** The lesson it came from, for the record. */
  lesson: string;
  from: string[];
}

/** principles.md with the rule appended as the next `P<n>`, created at 1.0.0 when there is none. */
export function withPrinciple(current: string | null, rule: LearnedRule): string {
  const base =
    current && current.trim()
      ? current.replace(/\s*$/, "\n")
      : "---\nprinciples_version: 1.0.0\n---\n\n# Principles\n";
  let next = 1;
  for (const m of base.matchAll(/^#{2,4}\s+P(\d+)\b/gm)) next = Math.max(next, Number(m[1]) + 1);
  const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
  const check = rule.run
    ? `<!-- specgate:principle run=${q(rule.run)}${rule.level ? ` level=${rule.level}` : ""} -->`
    : rule.forbid
      ? `<!-- specgate:principle forbid=${q(rule.forbid)} in=${q(rule.in || "**")}${rule.level ? ` level=${rule.level}` : ""} -->`
      : null;
  return [
    base,
    `## P${next} — ${rule.title}`,
    "",
    ...(check ? [check, ""] : []),
    `Learned from ${rule.lesson}: ${rule.from.join(", ")}.`,
    "",
  ].join("\n");
}
