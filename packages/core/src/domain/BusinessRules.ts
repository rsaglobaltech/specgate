/**
 * Business rules, numbered, each one tested (REQ-539).
 *
 * A requirement's rules used to be prose the gate could not count: a test
 * naming the requirement passed it, whichever of its rules it exercised. A
 * `Rules:` list whose items start with `BR-NNN` makes each rule a thing a test
 * names, and `validate --strict` reports the rule of a delivered requirement
 * that no test mentions — the gap a requirement-level link hides.
 *
 * Rule ids are unique across the specification, like requirement ids. Pure.
 */

export interface RuleRef {
  readonly id: string;
  readonly requirement: string;
  readonly file: string;
  /** 1-based. */
  readonly line: number;
}

export interface RequirementRules {
  readonly requirement: string;
  /** The `status=` of its trace comment, "" when it has none. */
  readonly status: string;
  readonly rules: readonly RuleRef[];
}

const HEADING = /^(#{2,4})\s+(?:Requirement:\s+)?(REQ-\d+)\b/;
const RULE_ITEM = /^\s*[-*]\s+\**(BR-\d+)\b/;
const STATUS = /\bstatus=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/;

/** Each requirement section of a spec, with the rules its `Rules:` list numbers. */
export function rulesIn(file: string, text: string): RequirementRules[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Array<{ requirement: string; status: string; rules: RuleRef[]; level: number }> = [];
  let current: (typeof out)[number] | null = null;
  let inRules = false;
  lines.forEach((line, i) => {
    const h = HEADING.exec(line);
    if (h) {
      current = { requirement: h[2], status: "", rules: [], level: h[1].length };
      out.push(current);
      inRules = false;
      return;
    }
    if (!current) return;
    const other = /^(#{1,6})\s+/.exec(line);
    if (other && other[1].length <= current.level) {
      current = null;
      return;
    }
    if (/^\s*\**Rules:?\**:?\s*$/i.test(line)) {
      inRules = true;
      return;
    }
    if (inRules) {
      const m = RULE_ITEM.exec(line);
      if (m) {
        current.rules.push({ id: m[1], requirement: current.requirement, file, line: i + 1 });
        return;
      }
      if (line.trim() !== "" && !/^\s{2,}\S/.test(line)) inRules = false;
    }
    if (line.includes("specgate:trace")) {
      const s = STATUS.exec(line);
      if (s) current.status = s[1] ?? s[2] ?? s[3] ?? "";
    }
  });
  return out
    .filter((r) => r.rules.length > 0)
    .map(({ requirement, status, rules }) => ({ requirement, status, rules }));
}

/**
 * Rule ids used more than once, each occurrence after the first: by another
 * requirement, or twice in one file. An open change's delta that restates a
 * requirement restates its rules too, and that is the same rule, not a second.
 */
export function duplicateRules(all: readonly RequirementRules[]): RuleRef[] {
  const first = new Map<string, RuleRef>();
  const seen = new Set<string>();
  const dup: RuleRef[] = [];
  for (const r of all.flatMap((x) => x.rules)) {
    const owner = first.get(r.id);
    if (!owner) first.set(r.id, r);
    else if (owner.file === r.file && owner.requirement === r.requirement) dup.push(r);
    else if (owner.requirement !== r.requirement) {
      // Another requirement's: reported once, not again for its restatement in a delta.
      const once = `${r.requirement} ${r.id}`;
      if (!seen.has(once)) dup.push(r);
      seen.add(once);
    }
  }
  return dup;
}

/** `BR-002` as a whole token. */
function mentions(source: string, id: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9])${id}(?![0-9])`).test(source);
}

/** The rules of delivered requirements that no test mentions. */
export function untestedRules(
  all: readonly RequirementRules[],
  tests: readonly string[],
  delivered: (requirement: string, traceStatus: string) => boolean
): RuleRef[] {
  // A rule restated by an open delta is reported once, where it was first read.
  const reported = new Set<string>();
  return all
    .filter((r) => delivered(r.requirement, r.status))
    .flatMap((r) => r.rules)
    .filter((rule) => !tests.some((t) => mentions(t, rule.id)))
    .filter((rule) => {
      const key = `${rule.requirement} ${rule.id}`;
      if (reported.has(key)) return false;
      reported.add(key);
      return true;
    });
}
