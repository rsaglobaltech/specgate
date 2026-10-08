/**
 * Does what the other tool calls done have evidence behind it? (ADR-0030)
 *
 * The rules of `specgate verify`, over a `ForeignSpec` and the project's test
 * sources. Pure: the caller reads files, runs the suite, consults git and the
 * lock, and hands the facts in.
 *
 * | Code | Fails when | Gate or report |
 * |---|---|---|
 * | V1 | a finished claim covers a criterion no test names | gate |
 * | V2 | the test command fails (decided by the caller) | gate |
 * | V3 | a claimed criterion's text changed since it was verified | gate |
 * | V4 | a claim refers to something the spec does not have | gate for a claim the tool cannot have meant; report when the spec moved on |
 * | V5 | a spec file does not read as its format | gate |
 * | V6 | a test names an id that does not exist | report |
 * | V7 | criteria no claim covers and no test names | report |
 *
 * A claim is gated when it is finished and, under `--since`, new. An
 * unfinished claim, or one older than `--since`, is reported: adopting the
 * check never turns a project red for work done before it (ADR-0023).
 */

import type { Diagnostic } from "./Diagnostic";
import { error, info, warning } from "./Diagnostic";
import { type ForeignSpec, type SourceText, idsNamedIn, namesId } from "./ForeignSpec";

export interface VerifyFacts {
  readonly spec: ForeignSpec;
  readonly tests: readonly SourceText[];
  /** Claims made after `--since`, by `datedBy`. Absent: every claim is new. */
  readonly freshClaims?: ReadonlySet<string>;
  /** `verify.lock`: criterion id → hash of its text when last verified. */
  readonly lock?: ReadonlyMap<string, string>;
  /** Hash of a criterion's text, the same function that wrote the lock. */
  readonly hash?: (text: string) => string;
  /** Unresolved references that are gated rather than reported. */
  readonly strictReferences?: boolean;
}

export interface ClaimResult {
  readonly label: string;
  readonly file: string;
  readonly gated: boolean;
  readonly criteria: ReadonlyArray<{ readonly id: string; readonly tests: readonly string[] }>;
}

export interface VerifyResult {
  readonly format: string;
  readonly claims: readonly ClaimResult[];
  readonly coverage: { readonly named: number; readonly total: number };
  /** Criteria a gated claim covers that are proved — what `--record` may write. */
  readonly proved: readonly string[];
  readonly status: Diagnostic[];
}

export function verifyClaims(facts: VerifyFacts): VerifyResult {
  const { spec, tests } = facts;
  const status: Diagnostic[] = [];

  for (const p of spec.problems) {
    status.push(
      error("V5_unreadable", `${p.file}:${p.line} — ${p.message}`, {
        file: p.file,
        line: p.line,
        fix: "Fix the file so its own tool reads it, or tell `verify` which format it is with `--from`.",
      })
    );
  }

  const criteria = new Map(spec.requirements.flatMap((r) => r.criteria.map((c) => [c.id, c])));
  const testsNaming = (id: string) => tests.filter((t) => namesId(t.source, id)).map((t) => t.path);

  const claims: ClaimResult[] = [];
  const proved = new Set<string>();
  for (const claim of spec.claims) {
    const fresh = !facts.freshClaims || facts.freshClaims.has(claim.datedBy);
    const gated = claim.finished && fresh;
    const results = claim.criteria.map((id) => ({ id, tests: testsNaming(id) }));
    claims.push({ label: claim.label, file: claim.file, gated, criteria: results });

    const where = { file: claim.file, line: claim.line };
    for (const r of results) {
      if (r.tests.length === 0) {
        const message = `${claim.label} claims ${r.id}, and no test names it.`;
        status.push(
          gated
            ? error("V1_unproved_claim", message, {
                ...where,
                target: r.id,
                fix: `Write a test that proves it and names \`${r.id}\` — a comment is enough.`,
              })
            : info(
                "V1_unproved_claim",
                `${message} (not gated: ${claim.finished ? "before --since" : "not finished"})`,
                {
                  ...where,
                  target: r.id,
                }
              )
        );
        continue;
      }
      const criterion = criteria.get(r.id);
      const recorded = facts.lock && facts.lock.get(r.id);
      if (gated && criterion && recorded && facts.hash && facts.hash(criterion.text) !== recorded) {
        status.push(
          error(
            "V3_criterion_changed",
            `${r.id} changed after it was verified; its tests prove the old text.`,
            {
              file: criterion.file,
              line: criterion.line,
              target: r.id,
              fix: "Check the tests against the new text, then record it again with `specgate verify --record`.",
            }
          )
        );
        continue;
      }
      if (gated) proved.add(r.id);
    }
    for (const u of claim.unresolved) {
      const message = `${claim.label} refers to ${u.ref}: ${u.why}.`;
      status.push(
        gated && facts.strictReferences
          ? error("V4_unknown_reference", message, { ...where, target: u.ref })
          : warning("V4_unknown_reference", message, { ...where, target: u.ref })
      );
    }
  }

  // Orphans: a test naming an id of this format that does not exist.
  const prefix = `${spec.format === "spec-kit" ? "speckit" : spec.format}:`;
  const known = new Set([...criteria.keys(), ...spec.requirements.map((r) => r.id)]);
  for (const c of spec.claims) c.criteria.forEach((id) => known.add(id));
  for (const t of tests) {
    for (const id of idsNamedIn(t.source)) {
      if (id.startsWith(prefix) && !known.has(id)) {
        status.push(
          warning(
            "V6_orphan_name",
            `${t.path} names ${id}, which the specification does not have.`,
            {
              file: t.path,
              target: id,
              fix: "Renamed or removed in the spec? Update the test to the current id (`specgate verify --ids`).",
            }
          )
        );
      }
    }
  }

  const named = [...criteria.keys()].filter((id) => testsNaming(id).length > 0).length;
  const claimed = new Set(spec.claims.flatMap((c) => c.criteria));
  const loose = [...criteria.keys()].filter(
    (id) => !claimed.has(id) && testsNaming(id).length === 0
  );
  if (loose.length > 0) {
    status.push(
      info(
        "V7_unclaimed_coverage",
        `${loose.length} of ${criteria.size} criteria are neither claimed done nor named by a test.`
      )
    );
  }

  return {
    format: spec.format,
    claims,
    coverage: { named, total: criteria.size },
    proved: [...proved],
    status,
  };
}
