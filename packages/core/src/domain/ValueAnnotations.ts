/**
 * Does the value a spec declares match the value the code declares?
 * (`PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.6.)
 *
 * ## The gap this closes
 *
 * `--strict-requirements` (F6) checks that a requirement's prose states an
 * obligation. `--strict-links` checks that a declared file still exists.
 * Neither checks what Predictable Code's own page uses as its example:
 * *"session timeout is 30m but spec requires 15m"*. This module compares an
 * explicit value on each side — no AST, no unit inference, no guessing a
 * variable's name from a requirement's prose.
 *
 * ## Why explicit annotation, and not something smarter
 *
 * The comparison is exact string equality between two things a human (or an
 * agent) wrote on purpose:
 *
 *   spec:  `<!-- specgate:trace uc=Login value_session_timeout=15m -->`
 *   code:  `// specgate:value session_timeout=15m`
 *
 * `specgate:value` is a plain literal string, not a language-specific comment
 * form — the same reason `specgate:trace` works identically in every markdown
 * file without knowing anything about markdown grammar. It is found by
 * scanning line by line, so it reads the same inside `//`, `#`, `--`, or no
 * comment marker at all. Interpreting units (`15m` vs `900000`) is exactly
 * the claim `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §5 refuses to make — that is
 * the H13 trap, a check asserting authority over a grammar it does not parse.
 *
 * ## Why this is a report, not a gate
 *
 * See §8.6: annotating every checkable fact by hand does not scale with
 * project size, and the fraction of requirements that reduce to a scalar
 * value shrinks as a system gets more complex. `compareDeclaredValues` never
 * decides pass/fail — it classifies. The caller (`ReportCommand.ts`) turns
 * that into a coverage-style report section, the same shape as `needsTest`
 * or `orphanFeatures`.
 */

/** A value the *spec* declares, from a `value_<id>=<literal>` trace key. */
export interface SpecValueEntry {
  readonly id: string;
  readonly value: string;
}

/** A value the *code* declares, from a `specgate:value <id>=<literal>` line. */
export interface CodeValueEntry {
  readonly id: string;
  readonly value: string;
  readonly line: number;
}

export type ValueDriftStatus = "matched" | "diverging" | "spec_only" | "code_only";

/** One identifier's comparison result, ready for a report row. */
export interface ValueComparison {
  readonly id: string;
  readonly specValue: string | null;
  readonly codeValue: string | null;
  readonly codeFile: string | null;
  readonly codeLine: number | null;
  readonly status: ValueDriftStatus;
}

const VALUE_PREFIX = "value_";

/**
 * Every `value_<id>=<literal>` key in an already-parsed `specgate:trace` comment.
 *
 * `SpecParser.parseTraceComment` already accepts any `[a-z_]+` key — this
 * reads the convention out of the flat object it returns. No parser change,
 * no new field.
 */
export function declaredSpecValues(
  trace: Record<string, string> | null | undefined
): SpecValueEntry[] {
  const out: SpecValueEntry[] = [];
  if (!trace) return out;
  for (const key of Object.keys(trace)) {
    if (key.length > VALUE_PREFIX.length && key.startsWith(VALUE_PREFIX)) {
      out.push({ id: key.slice(VALUE_PREFIX.length), value: trace[key] });
    }
  }
  return out;
}

/**
 * Every `specgate:value <id>=<literal>` marker in a source file's text.
 *
 * Line-oriented, not language-aware — the marker is found by scanning text,
 * not by parsing whatever comment syntax the file uses. `id` is restricted to
 * `[a-z_]+`, the same identifier space `specgate:trace` keys use, so a name is
 * either checkable on both sides or on neither.
 */
export function declaredCodeValues(source: string): CodeValueEntry[] {
  const out: CodeValueEntry[] = [];
  const re = /specgate:value\s+([a-z_]+)\s*=\s*(\S+)/i;
  const lines = String(source || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) out.push({ id: m[1].toLowerCase(), value: m[2], line: i + 1 });
  }
  return out;
}

/**
 * Compares one requirement's spec-declared values against the code values
 * found in the file(s) that requirement's matrix row points at.
 *
 * Scoped per requirement, not global: two unrelated requirements reusing the
 * same id (`session_timeout`) are never compared against each other, because
 * the caller only ever passes one requirement's code entries at a time.
 *
 * A repeated code id (the same marker in two files) keeps its first
 * occurrence, in the order the caller supplied — deterministic, not
 * "whichever file happened to be read last".
 */
export function compareDeclaredValues(
  specEntries: readonly SpecValueEntry[],
  codeEntries: readonly (CodeValueEntry & { readonly file: string })[]
): ValueComparison[] {
  const codeById = new Map<string, CodeValueEntry & { file: string }>();
  for (const entry of codeEntries) {
    if (!codeById.has(entry.id)) codeById.set(entry.id, entry);
  }

  const out: ValueComparison[] = [];
  const specIds = new Set(specEntries.map((e) => e.id));

  for (const spec of specEntries) {
    const code = codeById.get(spec.id);
    if (!code) {
      out.push({
        id: spec.id,
        specValue: spec.value,
        codeValue: null,
        codeFile: null,
        codeLine: null,
        status: "spec_only",
      });
      continue;
    }
    out.push({
      id: spec.id,
      specValue: spec.value,
      codeValue: code.value,
      codeFile: code.file,
      codeLine: code.line,
      status: code.value === spec.value ? "matched" : "diverging",
    });
  }

  for (const code of codeById.values()) {
    if (!specIds.has(code.id)) {
      out.push({
        id: code.id,
        specValue: null,
        codeValue: code.value,
        codeFile: code.file,
        codeLine: code.line,
        status: "code_only",
      });
    }
  }

  return out;
}
