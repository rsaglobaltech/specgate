/**
 * Merge a capability spec requirement by requirement (REQ-166).
 *
 * Git merges `docs/specs/capabilities/<x>/spec.md` by lines. Two changes
 * archived on two branches into the same capability — common once work is one
 * change per ticket — meet as a conflict even when they add different
 * requirements, and as an add/add conflict when the capability is new on both.
 * The unit that two branches actually share or not is a requirement: the
 * `### Requirement: REQ-nnn` heading and everything up to the next one.
 *
 * Per requirement, the usual three-way rule: a side that left it as in the
 * base yields to the side that changed it; two equal changes are one; two
 * different changes are a conflict on that requirement alone. Requirements are
 * written in id order. Pure: three texts in, one text out.
 */

export interface CapabilitySpecMergeResult {
  content: string;
  /** Requirement ids (or `preamble`) left with conflict markers. */
  conflicts: string[];
  /** None of the three looked like a capability spec: the caller merges by lines. */
  unparsable?: boolean;
}

const HEADING = /^### Requirement: (REQ-[\w.]+)/m;

interface Parsed {
  preamble: string;
  blocks: Map<string, string>;
}

function parse(text: string): Parsed {
  const normal = text.replace(/\r\n/g, "\n");
  const first = normal.search(HEADING);
  if (first === -1) return { preamble: normal, blocks: new Map() };
  const blocks = new Map<string, string>();
  for (const part of normal.slice(first).split(/(?=^### Requirement: )/m)) {
    const id = HEADING.exec(part)?.[1];
    if (id) blocks.set(id, part.replace(/\n*$/, "\n"));
  }
  return { preamble: normal.slice(0, first), blocks };
}

const numeric = (id: string) => Number(/(\d+)/.exec(id)?.[1] ?? 0);

/** Three-way choice for one unit; `null` when both sides changed it differently. */
function choose(
  base: string | undefined,
  ours: string | undefined,
  theirs: string | undefined
): { value: string | undefined } | null {
  if (ours === theirs) return { value: ours };
  if (ours === base) return { value: theirs };
  if (theirs === base) return { value: ours };
  return null;
}

const markers = (ours: string | undefined, theirs: string | undefined) =>
  `<<<<<<< ours\n${ours ?? ""}=======\n${theirs ?? ""}>>>>>>> theirs\n`;

export function mergeCapabilitySpec(
  base: string,
  ours: string,
  theirs: string
): CapabilitySpecMergeResult {
  const [b, o, t] = [parse(base), parse(ours), parse(theirs)];
  if (b.blocks.size + o.blocks.size + t.blocks.size === 0) {
    return { content: ours, conflicts: [], unparsable: true };
  }

  const conflicts: string[] = [];
  // A capability new on both sides has no base: its heading is whichever side wrote one.
  const pre = choose(b.preamble || undefined, o.preamble || undefined, t.preamble || undefined);
  let preamble: string;
  if (pre) preamble = pre.value ?? "";
  else if (!b.preamble) preamble = o.preamble || t.preamble;
  else {
    preamble = markers(o.preamble, t.preamble);
    conflicts.push("preamble");
  }

  const ids = [...new Set([...b.blocks.keys(), ...o.blocks.keys(), ...t.blocks.keys()])].sort(
    (x, y) => numeric(x) - numeric(y) || x.localeCompare(y)
  );
  const parts: string[] = [];
  for (const id of ids) {
    const picked = choose(b.blocks.get(id), o.blocks.get(id), t.blocks.get(id));
    if (picked) {
      if (picked.value !== undefined) parts.push(picked.value);
      continue;
    }
    parts.push(markers(o.blocks.get(id), t.blocks.get(id)));
    conflicts.push(id);
  }

  const body = parts.map((p) => p.replace(/\n*$/, "\n")).join("\n");
  const head = preamble.replace(/\n*$/, "\n\n");
  return { content: `${head}${body}`, conflicts };
}
