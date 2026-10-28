/**
 * SARIF findings and the baseline that keeps an existing codebase's debt from
 * failing the gate (ADR-0040 point 3, ADR-0028 points 3 and 4).
 *
 * A finding is identified by a fingerprint that survives the code moving: the
 * tool's own `partialFingerprints` when it writes them, otherwise the rule,
 * the file and a hash of the flagged line's text with its neighbours. Pure:
 * the caller reads files and hands their lines in.
 */

import { createHash } from "node:crypto";

export interface Finding {
  rule: string;
  level: string;
  /** Repository-relative, forward slashes. */
  path: string;
  line: number;
  message: string;
  fingerprint: string;
}

export interface Baseline {
  version: 1;
  /** Per check, the fingerprints accepted as existing debt. */
  checks: Record<string, string[]>;
}

export const EMPTY_BASELINE: Baseline = { version: 1, checks: {} };

/**
 * A SARIF location's file as a repository-relative path: `file:///src/x`
 * (the container's mount), `file:///C:/work/app/x` or `/work/app/x` (the
 * host's checkout), or already relative.
 */
export function relativePath(uri: string, projectDir: string): string {
  let p = decodeURIComponent(String(uri || "").replace(/^file:\/\//, ""));
  p = p.replace(/\\/g, "/");
  if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1);
  const root = projectDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const lowerP = p.toLowerCase();
  if (root && lowerP.startsWith(root.toLowerCase() + "/")) return p.slice(root.length + 1);
  if (p.startsWith("/src/")) return p.slice(5);
  return p.replace(/^\.\//, "");
}

const normalise = (s: string) => s.replace(/\s+/g, " ").trim();

/** The fingerprint of a result: the tool's, else rule + path + the line's text with its neighbours. */
export function fingerprint(
  rule: string,
  path: string,
  line: number,
  lines: string[] | null,
  partial?: Record<string, unknown>
): string {
  // Only fingerprints with a value: gitleaks scanning a folder writes them all
  // empty, which would make every finding the same one.
  const filled = partial
    ? Object.keys(partial).filter((k) => String(partial[k] ?? "").trim() !== "")
    : [];
  const own = filled
    .sort()
    .map((k) => `${k}=${String(partial![k])}`)
    .join(";");
  if (own) return `${rule}|${path}|${own}`;
  const text =
    lines && line > 0
      ? [lines[line - 2] || "", lines[line - 1] || "", lines[line] || ""].map(normalise).join("\n")
      : String(line);
  return `${rule}|${path}|${createHash("sha1").update(text).digest("hex").slice(0, 16)}`;
}

/** Every result of every run in a SARIF 2.1.0 document. */
export function readSarif(
  text: string,
  projectDir: string,
  linesOf: (path: string) => string[] | null,
  resolve?: (path: string) => string
): Finding[] {
  let doc: { runs?: Array<{ results?: unknown[] }> };
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("The SARIF file is not JSON.");
  }
  const out: Finding[] = [];
  for (const run of doc.runs || []) {
    for (const raw of run.results || []) {
      const r = raw as {
        ruleId?: string;
        rule?: { id?: string };
        level?: string;
        message?: { text?: string };
        locations?: Array<{
          physicalLocation?: {
            artifactLocation?: { uri?: string };
            region?: { startLine?: number };
          };
        }>;
        partialFingerprints?: Record<string, unknown>;
      };
      const loc = (r.locations || [])[0]?.physicalLocation;
      const named = relativePath(loc?.artifactLocation?.uri || "", projectDir);
      // SpotBugs names a file from its source root (com/shop/Order.java): the
      // caller finds the repository file it is.
      const path = named && resolve ? resolve(named) : named;
      const line = Number(loc?.region?.startLine) || 0;
      const rule = String(r.ruleId || r.rule?.id || "unknown");
      out.push({
        rule,
        level: String(r.level || "warning"),
        path,
        line,
        message: String(r.message?.text || "").trim(),
        fingerprint: fingerprint(
          rule,
          path,
          line,
          path ? linesOf(path) : null,
          r.partialFingerprints
        ),
      });
    }
  }
  return out;
}

/**
 * The findings a change adds: not in the check's baseline and, with a `diff`
 * scope, in a file the change touched.
 */
export function newFindings(
  findings: Finding[],
  baseline: Baseline,
  check: string,
  changedFiles: string[] | null
): { fresh: Finding[]; baselined: number } {
  const known = new Set(baseline.checks[check] || []);
  const changed = changedFiles ? new Set(changedFiles.map((f) => f.replace(/\\/g, "/"))) : null;
  const fresh: Finding[] = [];
  let baselined = 0;
  for (const f of findings) {
    if (known.has(f.fingerprint)) baselined += 1;
    else if (!changed || changed.has(f.path)) fresh.push(f);
  }
  return { fresh, baselined };
}

/** The baseline with one check's accepted findings replaced by these. */
export function acceptFindings(baseline: Baseline, check: string, findings: Finding[]): Baseline {
  return {
    version: 1,
    checks: {
      ...baseline.checks,
      [check]: [...new Set(findings.map((f) => f.fingerprint))].sort(),
    },
  };
}

/** A finding as one line for a person or an agent: `path:line [rule] message`. */
export function findingLine(f: Finding): string {
  return `${f.path || "?"}:${f.line || "?"} [${f.rule}] ${f.message.split("\n")[0]}`;
}
