import {
  DeltaNode,
  RenderableSpec,
  RequirementNode,
  SpecNode,
  parseSpec,
  parseDelta,
  requirementKey,
  renderSpec,
  REQ_ID,
  blockText,
} from "./SpecParser";
import { Diagnostic, error, warning } from "./Diagnostic";
// RFC2119 lives in RequirementSyntax.ts now (F6) — this is the only importer,
// so nothing needs a re-export.
import { RFC2119 } from "./RequirementSyntax";

export const VALID_SECTIONS = [
  "## Purpose",
  "## ADDED Requirements",
  "## MODIFIED Requirements",
  "## REMOVED Requirements",
];
export const GHERKIN_STEP = /^\s*(GIVEN|WHEN|THEN|AND|BUT|DADO|CUANDO|ENTONCES|Y)\b/i;

/**
 * A step that names a keyword and then says nothing.
 *
 * `GIVEN <!-- the precondition -->` and `WHEN TODO` are Gherkin by shape and
 * empty by content. They are what a generator writes when it has no acceptance
 * criterion to offer — `alm pull` writes them deliberately — and what a person
 * writes when they mean to come back later.
 */
export function isPlaceholderStep(step: string): boolean {
  // `(?:[^-]|-(?!->))*` instead of a lazy `[\s\S]*?`: it consumes without ever
  // needing to backtrack, which is the difference between linear and quadratic
  // on a step that contains many dashes.
  const withoutComments = String(step).replace(/<!--(?:[^-]|-(?!->))*-->/g, " ");
  // The parser hands steps over without their bullet, but this is exported and
  // a caller may well pass the raw line, so both forms have to read the same.
  const withoutBullet = withoutComments.replace(/^\s*[-*]\s*/, "");
  const body = withoutBullet.replace(GHERKIN_STEP, "").trim();
  if (body === "") return true;
  return /^(todo|tbd|\.\.\.|…|<[^>]*>)$/i.test(body);
}

/** What `DeltaSpec.validate` needs besides the delta. */
export interface DeltaValidateOptions {
  /** Where the delta lives, for the diagnostics. */
  file?: string;
  /** The capability spec the delta applies to; checked against when given. */
  specSource?: string | null;
  /**
   * Passed by `change validate`, not read here: the checks are the same either
   * way, and what `--strict` makes of a warning is the caller's decision.
   */
  strict?: boolean;
}

/** What `DeltaSpec.apply` produced: the new spec, and which keys moved. */
export interface AppliedDelta {
  markdown: string;
  spec: SpecNode;
  applied: { added: string[]; modified: string[]; removed: string[] };
  /** Every requirement is gone: the capability itself is being retired. */
  retired: boolean;
}

export class DeltaSpec {
  public static validate(
    deltaSource: string,
    opts?: DeltaValidateOptions
  ): { delta: DeltaNode; diagnostics: Diagnostic[] } {
    const o = opts || {};
    const file = o.file || "spec.md";
    const diags: Diagnostic[] = [];
    const delta = parseDelta(deltaSource);

    for (const unknown of delta.unknownSections) {
      diags.push(
        error("delta_unknown_section", `Unknown delta section: "## ${unknown.heading}".`, {
          file,
          line: unknown.line,
          // Null only for requirements above the first heading; the envelope
          // has always carried that null through as it is.
          target: unknown.heading as string,
          fix: `Use one of: ${VALID_SECTIONS.join(", ")}.`,
        })
      );
    }

    const all = [...delta.added, ...delta.modified, ...delta.removed];

    if (all.length === 0 && !delta.purpose) {
      diags.push(
        error("delta_empty", "Delta declares no requirement changes and no Purpose.", {
          file,
          fix: "Add a `## ADDED Requirements` section, or delete the delta file.",
        })
      );
    }

    const seen = new Map<string, number>();
    for (const req of all) {
      const key = requirementKey(req);
      if (seen.has(key)) {
        diags.push(
          error(
            "duplicate_requirement",
            `Requirement "${req.heading}" appears more than once in this delta.`,
            {
              file,
              line: req.line,
              target: key,
              fix: `Merge the two blocks; the first one is at line ${seen.get(key)}.`,
            }
          )
        );
      } else {
        seen.set(key, req.line);
      }

      if (req.id && !REQ_ID.test(req.id)) {
        diags.push(
          error("invalid_requirement_id", `"${req.id}" is not a valid requirement id.`, {
            file,
            line: req.line,
            target: req.id,
            fix: "Use the form REQ-NNN, e.g. REQ-014 — or drop the id entirely.",
          })
        );
      }
    }

    for (const req of [...delta.added, ...delta.modified]) {
      if (!req.scenarios || req.scenarios.length === 0) {
        diags.push(
          error(
            "requirement_without_scenario",
            `Requirement "${req.name}" has no scenario, so "done" is undefined.`,
            {
              file,
              line: req.line,
              target: requirementKey(req),
              fix: "Add a `#### Scenario:` block with GIVEN / WHEN / THEN steps.",
            }
          )
        );
      }
      // A scenario is named with its requirement: a scenario title alone does
      // not say where to look in a delta of twenty requirements.
      const of = req.id ? ` of ${req.id}` : "";
      for (const sc of req.scenarios || []) {
        if (!sc.steps || sc.steps.length === 0) {
          diags.push(
            error("scenario_without_steps", `Scenario "${sc.name}"${of} has no steps.`, {
              file,
              line: sc.line,
              target: sc.name,
              fix: "Add `- GIVEN …`, `- WHEN …`, `- THEN …` bullets under the scenario.",
            })
          );
        } else if (sc.steps.every((s: string) => isPlaceholderStep(s))) {
          // Every step is a keyword with nothing behind it — `GIVEN <!-- the
          // precondition -->`, or a bare `WHEN TODO`. These pass the checks
          // above because they *are* Gherkin, and that is the problem: the
          // scenario satisfies the gate without describing any behaviour, which
          // turns the gate from a check into a formality.
          //
          // ADR-0021 rejected exactly this shape when it refused to import
          // tickets with placeholder scenarios. `alm pull` writes deltas in
          // precisely this state on purpose, so the gate has to be the thing
          // that keeps them from being archived.
          diags.push(
            error(
              "scenario_steps_unwritten",
              `Scenario "${sc.name}"${of} has placeholder steps, so it asserts nothing.`,
              {
                file,
                line: sc.line,
                target: sc.name,
                fix: "Write what actually has to hold: `- GIVEN a customer on the flat tariff`, not `- GIVEN <!-- the precondition -->`.",
              }
            )
          );
        } else if (!sc.steps.some((s: string) => GHERKIN_STEP.test(s))) {
          diags.push(
            warning(
              "scenario_not_gherkin",
              `Scenario "${sc.name}"${of} has no GIVEN/WHEN/THEN step, so it cannot generate a .feature.`,
              {
                file,
                line: sc.line,
                target: sc.name,
                fix: "Start each step with GIVEN, WHEN, THEN or AND.",
              }
            )
          );
        }
      }
      const requirementText = blockText(req.text);
      if (requirementText && !RFC2119.test(requirementText)) {
        diags.push(
          warning(
            "no_rfc2119_keyword",
            `Requirement "${req.name}" states no obligation (SHALL / MUST / SHOULD / MAY).`,
            {
              file,
              line: req.line,
              target: requirementKey(req),
              fix: 'Rewrite the body as "The system SHALL …".',
            }
          )
        );
      }
    }

    if (o.specSource !== undefined && o.specSource !== null) {
      const spec = parseSpec(o.specSource);
      const existing = new Set(spec.requirements.map((r) => requirementKey(r)));

      for (const req of delta.added) {
        if (existing.has(requirementKey(req))) {
          diags.push(
            error(
              "requirement_already_exists",
              `ADDED requirement "${req.heading}" already exists in the capability spec.`,
              {
                file,
                line: req.line,
                target: requirementKey(req),
                fix: "Move the block to `## MODIFIED Requirements`.",
              }
            )
          );
        }
      }
      for (const req of [...delta.modified, ...delta.removed]) {
        if (!existing.has(requirementKey(req))) {
          diags.push(
            error(
              "unknown_requirement",
              // Non-null: `parseDelta` sets `op` on every requirement it buckets.
              `${req.op!.toUpperCase()} requirement "${req.heading}" does not exist in the capability spec.`,
              {
                file,
                line: req.line,
                target: requirementKey(req),
                fix:
                  req.op === "modified"
                    ? "Move the block to `## ADDED Requirements`, or fix the heading to match the spec."
                    : "Remove the block — there is nothing to delete.",
              }
            )
          );
        }
      }
    }

    return { delta, diagnostics: diags };
  }

  public static apply(
    specSource: string | null,
    deltaSource: string,
    opts?: { title?: string }
  ): AppliedDelta {
    const o = opts || {};
    const delta = parseDelta(deltaSource);
    const spec: SpecNode = specSource
      ? parseSpec(specSource)
      : { title: o.title || "Specification", purpose: "", requirements: [], sections: [] };

    if (!specSource && delta.purpose) spec.purpose = delta.purpose;
    if (!spec.title) spec.title = delta.title || o.title || "Specification";

    const applied = { added: [] as string[], modified: [] as string[], removed: [] as string[] };
    const byKey = new Map<string, RequirementNode>(
      spec.requirements.map((r) => [requirementKey(r), r])
    );

    for (const req of delta.removed) {
      const key = requirementKey(req);
      if (byKey.has(key)) {
        byKey.delete(key);
        applied.removed.push(key);
      }
    }
    for (const req of delta.modified) {
      const key = requirementKey(req);
      if (byKey.has(key)) {
        byKey.set(key, this.stripOp(req));
        applied.modified.push(key);
      }
    }
    for (const req of delta.added) {
      const key = requirementKey(req);
      if (!byKey.has(key)) {
        byKey.set(key, this.stripOp(req));
        applied.added.push(key);
      }
    }

    const order = spec.requirements.map((r) => requirementKey(r)).filter((k) => byKey.has(k));
    for (const key of byKey.keys()) {
      if (!order.includes(key)) order.push(key);
    }
    // Non-null: `order` holds only keys `byKey` has.
    spec.requirements = order.map((k) => byKey.get(k)!);

    return {
      // Parsed, so every block is one string by now — what the renderer reads.
      markdown: renderSpec(spec as RenderableSpec),
      spec,
      applied,
      retired: spec.requirements.length === 0 && applied.removed.length > 0,
    };
  }

  private static stripOp(req: RequirementNode): Omit<RequirementNode, "op"> {
    const { op: _op, ...rest } = req;
    return rest;
  }
}
