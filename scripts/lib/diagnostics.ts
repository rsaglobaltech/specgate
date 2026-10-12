/**
 * Rendering diagnostics for a human at a terminal.
 *
 * The envelope itself — the `Diagnostic` shape, its constructors and its
 * predicates — is domain, and lives in `packages/core/src/domain/Diagnostic`.
 * This module is the delivery half: colours, stream writes and the `--json`
 * failure shape. It re-exports the domain half so the ~28 existing importers
 * keep one import site.
 */

import { Diagnostic, SEVERITY } from "../../packages/core/src/domain/Diagnostic";

export {
  Diagnostic,
  DiagnosticExtra,
  SEVERITY,
  diagnostic,
  error,
  warning,
  info,
  hasErrors,
  countBySeverity,
  errorMessage,
} from "../../packages/core/src/domain/Diagnostic";

// ── Human rendering ───────────────────────────────────────────────────────────

import { c, sym } from "./ui";

const MARK = {
  [SEVERITY.ERROR]: `${c.bad}${sym.fail}${c.reset}`,
  [SEVERITY.WARNING]: `${c.warn}${sym.warn}${c.reset}`,
  [SEVERITY.INFO]: `${c.note}${sym.info}${c.reset}`,
};

/**
 *   ✖  docs/brief.md  The agent wrote no front matter.  [draft_no_front_matter]
 *      fix: Run `specgate draft` to see the four fields…
 */
export function formatDiagnostic(d: Diagnostic) {
  const where = d.file ? `${d.file}${d.line ? `:${d.line}` : ""}` : d.target || "";
  const head = `  ${MARK[d.severity] || "-"}  ${where ? `${c.muted}${where}${c.reset}  ` : ""}${d.message}`;
  const fix = d.fix ? `\n     ${c.muted}fix:${c.reset} ${d.fix}` : "";
  const code = `${c.muted}[${d.code}]${c.reset}`;
  return `${head}  ${code}${fix}`;
}

export function printDiagnostics(diags, stream?) {
  const out = stream || process.stderr;
  for (const d of diags || []) out.write(`${formatDiagnostic(d)}\n`);
}

/**
 * The failure shape for `--json` mode: one JSON document on stdout carrying the
 * command's null-shape plus the diagnostics, and exit 1. Prose never goes to
 * stdout in JSON mode, so a consumer can always `| jq .`.
 */
export function failJson(nullShape, diags) {
  process.stdout.write(`${JSON.stringify({ ...nullShape, status: diags }, null, 2)}\n`);
  process.exit(1);
}
