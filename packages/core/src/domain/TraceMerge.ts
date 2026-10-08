/**
 * Reconciling a file that carries `csda:trace` comments.
 *
 * A trace comment is one line holding fields with two owners: the pack writes
 * the model links (`uc`, `cmd`, `agg`, `evt`, `context`, `depends`, `kind`),
 * and the project writes its progress (`status` from `done`, `test` and
 * `artifact` from `req link`). Merged as text, that line is where both sides
 * change, so sync either conflicted on it or — when the pack's template text
 * had not moved — kept the local line and silently dropped what the pack
 * changed. Found building a real product from packs (golden_app, finding
 * #24): a pack added `depends_on`, `sync` moved the lock to the new tag, and
 * no requirement ever saw the dependency.
 *
 * So the trace lines are taken out of the text merge and merged field by
 * field: a field the pack changed since the baseline takes the pack's value;
 * every other field keeps the project's. The rest of the file goes through
 * the ordinary three-way merge. Pure, like `reconcile`.
 */

import { parseTraceComment } from "./SpecParser";
import { renderTraceComment } from "./DerivedMatrix";
import {
  CONFLICT_OUTCOMES,
  reconcile,
  type MergeFn,
  type ReconcileDecision,
  type ReconcileOptions,
} from "./Reconciliation";

type Fields = Record<string, string>;

const HEADING = /^#{1,6}\s+(?:Requirement:\s*)?(REQ-[A-Za-z0-9.]+)?/;
const TRACE = /<!--\s*csda:trace\b.*?-->/;
const MASK = "<!-- csda:trace -->";

/** The fields a pack writes into a trace comment; the rest belong to the project. */
export const PACK_TRACE_KEYS: ReadonlySet<string> = new Set([
  "uc",
  "cmd",
  "qry",
  "agg",
  "evt",
  "context",
  "depends",
  "kind",
]);

function hasTrace(text: string | null): boolean {
  return text !== null && TRACE.test(text);
}

/** Each trace line replaced by a bare marker, so the text merge never sees fields. */
export function maskTraces(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(TRACE, MASK))
    .join("\n");
}

/** Requirement id → its first trace line, as written. */
function traceLines(text: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (text === null) return out;
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const h = HEADING.exec(line.trim());
    if (h) {
      current = h[1] || null;
      continue;
    }
    const t = TRACE.exec(line);
    if (t && current && !out.has(current)) out.set(current, t[0]);
  }
  return out;
}

function fieldsOf(line: string | undefined): Fields | undefined {
  return line === undefined ? undefined : (parseTraceComment(line) as Fields);
}

function sameFields(a: Fields, b: Fields): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * One requirement's fields after the pack moved from `base` to `incoming`
 * while the project held `local`. With no base, only the pack's own keys are
 * taken from `incoming`, since there is nothing to say what the pack changed.
 */
export function mergeTraceFields(
  base: Fields | undefined,
  local: Fields | undefined,
  incoming: Fields | undefined
): Fields {
  if (local === undefined) return { ...(incoming || {}) };
  const out: Fields = { ...local };
  const theirs = incoming || {};
  if (base === undefined) {
    for (const [k, v] of Object.entries(theirs)) if (PACK_TRACE_KEYS.has(k)) out[k] = v;
    return out;
  }
  for (const k of new Set([...Object.keys(base), ...Object.keys(theirs)])) {
    if (theirs[k] === base[k]) continue;
    if (theirs[k] === undefined) delete out[k];
    else out[k] = theirs[k];
  }
  return out;
}

/** Put the merged trace lines back where the masked text has markers. */
function rehydrate(
  masked: string,
  baseLines: Map<string, string>,
  localLines: Map<string, string>,
  incomingLines: Map<string, string>,
  baseKnown: boolean
): string {
  const lines = masked.split("\n");
  let current: string | null = null;
  const placed = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const h = HEADING.exec(line.trim());
    if (h) current = h[1] || null;
    if (!line.includes(MASK) || !current || placed.has(current)) {
      out.push(line);
      continue;
    }
    placed.add(current);
    const local = localLines.get(current);
    const incoming = incomingLines.get(current);
    const fields = mergeTraceFields(
      baseKnown ? fieldsOf(baseLines.get(current)) || {} : undefined,
      fieldsOf(local),
      fieldsOf(incoming)
    );
    // Keep a line as it was written when its fields did not change, so a
    // sync that changes nothing leaves no diff.
    const verbatim = [local, incoming].find(
      (l) => l !== undefined && sameFields(fieldsOf(l)!, fields)
    );
    const rendered = verbatim ?? renderTraceComment(fields);
    if (rendered !== null) out.push(line.replace(MASK, rendered));
  }
  return out.join("\n");
}

/**
 * `reconcile`, with `csda:trace` lines merged field by field. Files without
 * trace comments, `--force`, and genuine text conflicts take the plain path.
 */
export function reconcileTraced(
  base: string | null,
  local: string | null,
  incoming: string,
  opts: ReconcileOptions,
  merge: MergeFn
): ReconcileDecision {
  if (local === null || opts.force || !(hasTrace(local) || hasTrace(incoming))) {
    return reconcile(base, local, incoming, opts, merge);
  }
  if (local === incoming) return reconcile(base, local, incoming, opts, merge);

  const maskedLocal = maskTraces(local);
  const maskedIncoming = maskTraces(incoming);
  const maskedBase = base === null ? null : maskTraces(base);

  // No baseline and only trace fields differ: the pack's own keys are safe to
  // take; refusing would leave the project on the old model forever.
  const text =
    maskedBase === null && maskedLocal === maskedIncoming
      ? ({ outcome: "kept", write: null, baselineContent: null } as ReconcileDecision)
      : reconcile(maskedBase, maskedLocal, maskedIncoming, opts, merge);
  if (CONFLICT_OUTCOMES.has(text.outcome)) return reconcile(base, local, incoming, opts, merge);

  const final = rehydrate(
    text.write ?? maskedLocal,
    traceLines(base),
    traceLines(local),
    traceLines(incoming),
    base !== null
  );
  if (final === local) {
    return {
      outcome: text.outcome === "kept" ? "kept" : "unchanged",
      write: null,
      baselineContent: incoming,
    };
  }
  const outcome = text.outcome === "updated" ? "updated" : "merged";
  return { outcome, write: final, baselineContent: incoming };
}
