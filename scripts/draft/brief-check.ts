/**
 * The brief rules, B1 to B11, as diagnostics (ADR-0038).
 *
 * B1 is the front matter's shapes and fields (`brief-setup.ts`); B2 to B11
 * read the body's module cards (`BriefCards`). `propose --from-brief --check`
 * prints them, the overview stops on their errors, and a draft is not opened
 * over one.
 */

import type { Diagnostic } from "../../packages/core/src/domain/Diagnostic";
import { error, hasErrors } from "../../packages/core/src/domain/Diagnostic";
import { checkBriefBody } from "../../packages/core/src/domain/BriefCards";
import { checkFrontMatter, frontMatter } from "./brief-setup";

/** Every finding on a brief, front matter first; `file` is the brief's path. */
export function checkBrief(text: string, file: string): Diagnostic[] {
  const head =
    frontMatter(text) === null
      ? [
          error("brief_no_front_matter", "The brief has no front matter.", {
            fix: "Run `specgate propose --from-brief` — it shows the four fields to add at the top.",
          }),
        ]
      : checkFrontMatter(text).map((p) => error(p.code, p.message, { fix: p.fix }));
  const rank = { error: 0, warning: 1, info: 2 };
  return [...head, ...checkBriefBody(text)]
    .map((d) => ({ ...d, file }))
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Whether a draft may be opened from this brief: no error among its findings. */
export function briefReady(findings: readonly Diagnostic[]): boolean {
  return !hasErrors(findings);
}
