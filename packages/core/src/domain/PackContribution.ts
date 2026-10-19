/**
 * A change, expressed as a fragment of `pack.yaml`.
 *
 * `specops contribute` sends work back upstream: a capability the project
 * wrote or amended becomes requirements and scenarios a pack maintainer can
 * merge. This is the inverse of `PackDelta`, which turns a pack bump into a
 * change — and like it, the interesting part is a rendering, so it is pure and
 * the git work stays outside.
 */

import { DeltaNode, RequirementNode, TraceComment, blockText } from "./SpecParser";
import { PackDeltaSummary } from "./PackDelta";

const yamlString = (v: unknown) =>
  // Backslash first: escaping only the quote leaves `\\` before it able to
  // escape the escape, and the value breaks out of its own string.
  `"${String(v === undefined || v === null ? "" : v)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

/**
 * Express a delta's requirements in the pack's own model shape.
 *
 * The inverse of `as_change.deriveDelta`: that reads `pack.yaml` and writes a
 * delta, this reads a delta and writes a `pack.yaml` fragment. Round-tripping
 * the two is what makes the pack and the project speak one language.
 */
export function deltaToPackFragment(
  delta: Pick<DeltaNode, "added" | "modified" | "removed">,
  opts?: { changeId?: string }
): string | null {
  const o = opts || {};
  const requirements: string[] = [];
  const scenarios: string[] = [];

  const emit = (req: RequirementNode, disposition: string | null) => {
    const trace: TraceComment = req.trace || {};
    requirements.push(
      [
        `  - id: ${req.id || "REQ-TODO"}`,
        `    title: ${yamlString(req.name)}`,
        `    priority: ${trace.priority || "Should"}`,
        `    description: ${yamlString(blockText(req.text).split("\n")[0])}`,
        `    status: Draft`,
        disposition ? `    # ${disposition}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );

    for (const sc of req.scenarios || []) {
      scenarios.push(
        [
          `  - id: ${yamlString(sc.id || "SCN-TODO")}`,
          `    requirement_id: ${req.id || "REQ-TODO"}`,
          trace.uc ? `    use_case: ${trace.uc}` : null,
          trace.feature ? `    target: ${yamlString(trace.feature)}` : null,
          `    scenario: ${yamlString(sc.name)}`,
          trace.cmd ? `    command: ${trace.cmd}` : null,
          trace.agg ? `    aggregate: ${trace.agg}` : null,
          trace.evt ? `    events:\n      - ${trace.evt}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  };

  for (const req of delta.added) emit(req, null);
  for (const req of delta.modified)
    emit(req, "MODIFIED upstream — reconcile with the existing entry");
  const removed = delta.removed.map((req) => `  # REMOVED locally: ${req.id || req.name}`);

  const lines = [`# Contribution fragment${o.changeId ? ` — ${o.changeId}` : ""}`, ""];
  if (requirements.length > 0) {
    lines.push("requirements:", ...requirements, "");
  }
  if (scenarios.length > 0) {
    lines.push("scenarios:", ...scenarios, "");
  }
  if (removed.length > 0) {
    lines.push("# Requirements this project retired locally:", ...removed, "");
  }
  if (requirements.length === 0 && scenarios.length === 0 && removed.length === 0) {
    return null;
  }
  while (lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}

export function contributionReadme(
  changeId: string,
  packId: string,
  proposal: string | null | undefined,
  summary: PackDeltaSummary
): string {
  return `# Contribution: ${changeId}

Proposed upstream from a project consuming \`${packId}\`.

## Summary

- Added: ${summary.added.join(", ") || "—"}
- Modified: ${summary.modified.join(", ") || "—"}
- Removed locally: ${summary.removed.join(", ") || "—"}

## Files in this contribution

| File | What it is |
| --- | --- |
| \`fragment.yaml\` | The requirements and scenarios expressed in the pack's model shape. **Not merged into \`pack.yaml\` automatically** — a maintainer decides where each entry belongs and whether the ids collide. |
| \`delta.md\` | The same change as a delta spec, for reading. |
| \`proposal.md\` | The consuming project's original proposal. |

## Original proposal

${proposal || "_(the change carried no proposal.md)_"}
`;
}

// ── Git staging ───────────────────────────────────────────────────────────────
