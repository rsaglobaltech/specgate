/**
 * The one diagnostic envelope every machine-readable surface of the CLI emits.
 *
 *   { severity, code, message, target?, fix?, file?, line? }
 *
 * `code` is a stable snake_case string — callers (CI, agents, the VS Code
 * extension) branch on it, never on the message text. `fix` is one actionable
 * sentence or command; a diagnostic without a fix is a diagnostic the user
 * cannot act on, so treat writing one as part of writing the check.
 *
 * Casing is camelCase everywhere in JSON output, decided once here so we do not
 * inherit the snake/camel split that OpenSpec documents as a known defect.
 *
 * This module is the envelope and nothing else: no colours, no streams, no
 * `process`. Rendering a diagnostic for a terminal is a delivery concern and
 * lives in `scripts/lib/diagnostics`, which re-exports everything here.
 */

/** The one diagnostic envelope, as ADR-0017 fixes it. */
export interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  target?: string;
  fix?: string;
  file?: string;
  line?: number;
}

export interface DiagnosticExtra {
  target?: string;
  fix?: string;
  file?: string;
  line?: number;
}

export const SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

/** How bad a diagnostic is. */
export type Severity = Diagnostic["severity"];

export function diagnostic(
  severity: Severity,
  code: string,
  message: string,
  extra?: DiagnosticExtra
): Diagnostic {
  const d: Diagnostic = { severity, code, message };
  if (extra) {
    if (extra.target !== undefined) d.target = extra.target;
    if (extra.fix !== undefined) d.fix = extra.fix;
    if (extra.file !== undefined) d.file = extra.file;
    if (extra.line !== undefined && extra.line !== null) d.line = extra.line;
  }
  return d;
}

export const error = (code: string, message: string, extra?: DiagnosticExtra) =>
  diagnostic(SEVERITY.ERROR, code, message, extra);
export const warning = (code: string, message: string, extra?: DiagnosticExtra) =>
  diagnostic(SEVERITY.WARNING, code, message, extra);
export const info = (code: string, message: string, extra?: DiagnosticExtra) =>
  diagnostic(SEVERITY.INFO, code, message, extra);

export function hasErrors(
  diags: readonly Pick<Diagnostic, "severity">[] | null | undefined
): boolean {
  return (diags || []).some((d) => d.severity === SEVERITY.ERROR);
}

export function countBySeverity(
  diags: readonly Pick<Diagnostic, "severity">[] | null | undefined
): Record<Severity, number> {
  const out = { error: 0, warning: 0, info: 0 };
  for (const d of diags || []) {
    if (out[d.severity] !== undefined) out[d.severity]++;
  }
  return out;
}

/**
 * The message of whatever was thrown.
 *
 * `catch (err)` appeared eleven times across `scripts/` purely to reach
 * `.message`. A catch binding is genuinely `unknown` — anything can be thrown —
 * so the honest form is to narrow it once, here.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}
