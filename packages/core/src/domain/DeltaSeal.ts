/**
 * What an approval is of, requirement by requirement (approved-delta REQ-739,
 * REQ-740): a seal of each requirement's heading, statement and scenarios as
 * the delta has them, and what differs between the seals an approval recorded
 * and the delta now. Pure.
 */
import { createHash } from "node:crypto";

/** Requirement id → the seal of its block. */
export type Seals = Record<string, string>;

const HEADING = /^###\s+Requirement:\s*(REQ-\d+)\b/;
/** A heading that ends a requirement's block: the next requirement, or a section. */
const ENDS = /^#{1,3}\s/;
const TRACE = /<!--\s*specgate:trace\b[\s\S]*?-->/g;

/** Each requirement of a delta and its block: from its heading to the next requirement or section. */
export function requirementBlocks(delta: string): Map<string, string> {
  const out = new Map<string, string>();
  let id = "";
  let block: string[] = [];
  const close = () => {
    if (id) out.set(id, block.join("\n"));
  };
  for (const line of delta.replace(/\r\n/g, "\n").split("\n")) {
    const m = HEADING.exec(line);
    if (m) {
      close();
      id = m[1]!;
      block = [line];
    } else if (id && ENDS.test(line)) {
      close();
      id = "";
      block = [];
    } else if (id) {
      block.push(line);
    }
  }
  close();
  return out;
}

/**
 * The seal of one block. The `specgate:trace` comment is left out — `apply`
 * writes the status there, and delivering is not changing —, as are blank
 * lines and the space at a line's end.
 */
export function sealOf(block: string): string {
  const text = block
    .replace(TRACE, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter(Boolean)
    .join("\n");
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

/** The seals of every requirement in a change's deltas. */
export function sealsOf(deltas: string[]): Seals {
  const out: Seals = {};
  for (const delta of deltas) {
    for (const [id, block] of requirementBlocks(delta)) out[id] = sealOf(block);
  }
  return out;
}

export interface SealDiff {
  /** Sealed, and its statement or scenarios are not what was sealed. */
  changed: string[];
  /** In the delta, and not sealed: added after the approval. */
  added: string[];
  /** Sealed, and no longer in the delta. */
  gone: string[];
}

const byNumber = (a: string, b: string) => Number(a.slice(4)) - Number(b.slice(4));

export function sealDiff(sealed: Seals, now: Seals): SealDiff {
  const changed: string[] = [];
  const gone: string[] = [];
  for (const [id, seal] of Object.entries(sealed)) {
    if (!(id in now)) gone.push(id);
    else if (now[id] !== seal) changed.push(id);
  }
  const added = Object.keys(now).filter((id) => !(id in sealed));
  return { changed: changed.sort(byNumber), added: added.sort(byNumber), gone: gone.sort(byNumber) };
}
