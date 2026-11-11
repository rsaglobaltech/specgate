/**
 * Which capability states each requirement (REQ-500): the folder of its
 * capability spec under `docs/specs/capabilities/`, or of the delta of the open
 * change that adds it — the name `propose --capability` gives. A requirement
 * stated only in `spec.md` has none.
 *
 * `status --json`, `report --capability` and `harness report --capability`
 * read it here, so the three agree.
 */

import { readCapabilityRequirements } from "./capability-specs";
import { inFlightRequirements } from "./in-flight";
import { error } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";

/** Requirement id → capability. An open change's delta wins over the archived spec. */
export function requirementCapabilities(projectDir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of readCapabilityRequirements(projectDir)) {
    if (r.req.id) map.set(r.req.id, r.capability);
  }
  for (const r of inFlightRequirements(projectDir)) map.set(r.id, r.capability);
  return map;
}

/** The capabilities the project has, sorted. */
export function capabilityNames(map: Map<string, string>): string[] {
  return [...new Set(map.values())].sort();
}

/** The refusal of `--capability <name>` for a capability the project does not have. */
export function unknownCapability(name: string, known: string[], command: string): Diagnostic {
  return error("capability_unknown", `This project has no capability ${name}.`, {
    target: name,
    fix: known.length
      ? `Use one of: ${known.join(", ")} — \`${command} --capability ${known[0]}\`.`
      : "This project has no capability yet: `specgate propose <change-id> --capability <name>` opens one.",
  });
}
