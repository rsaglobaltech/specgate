import { DeltaSpec } from "../../packages/core/src/domain/DeltaSpec";

/**
 * Delta diagnostics codes:
 * error("no_rfc2119_keyword")
 * error("scenario_not_gherkin")
 * error("delta_unknown_section")
 * error("delta_empty")
 * error("duplicate_requirement")
 */

type ValidateOptions = Parameters<typeof DeltaSpec.validate>[1];
type ApplyOptions = Parameters<typeof DeltaSpec.apply>[2];

export function validateDelta(deltaSource: string, opts?: ValidateOptions) {
  return DeltaSpec.validate(deltaSource, opts);
}

export function applyDelta(specSource: string | null, deltaSource: string, opts?: ApplyOptions) {
  return DeltaSpec.apply(specSource, deltaSource, opts);
}
