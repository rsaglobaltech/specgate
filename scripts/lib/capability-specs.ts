/**
 * The one reader of `docs/specs/capabilities/**\/spec.md`.
 *
 * Two callers need this: `specgate report` (§8.6, declared-value drift) and
 * `specgate change new --from-value-drift` (three-routes resolution). Each wrote
 * its own copy first; the F1/A3 lesson is that two hand-written readers of
 * the same thing drift, so this is the single one both import.
 *
 * Absent entirely on most projects — `specgate init` never writes this
 * directory, it belongs to the change-lifecycle structure (`specgate change`).
 * No directory is not an error here; it is "nothing to read yet".
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseSpec } from "../../packages/core/src/domain/SpecParser";
import type { RequirementNode } from "../../packages/core/src/domain/SpecParser";
import { CAPABILITIES_DIR } from "../../packages/core/src/infrastructure/ChangeWorkspace";

export interface CapabilityRequirement {
  /** The parsed requirement — `.id`, `.text`, `.scenarios`, `.trace`. */
  req: RequirementNode;
  /** The capability's directory name under `docs/specs/capabilities/`. */
  capability: string;
  /** The spec.md path, relative to `projectDir`, posix separators. */
  specFile: string;
}

export function readCapabilityRequirements(projectDir: string): CapabilityRequirement[] {
  const capabilitiesDir = path.join(projectDir, CAPABILITIES_DIR);
  if (!fs.existsSync(capabilitiesDir)) return [];

  const out: CapabilityRequirement[] = [];
  const entries = fs
    .readdirSync(capabilitiesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const specPath = path.join(capabilitiesDir, entry.name, "spec.md");
    if (!fs.existsSync(specPath)) continue;
    const rel = path.relative(projectDir, specPath).split(path.sep).join("/");
    let spec: ReturnType<typeof parseSpec>;
    try {
      spec = parseSpec(fs.readFileSync(specPath, "utf8"));
    } catch {
      continue;
    }
    for (const req of spec.requirements || []) {
      out.push({ req, capability: entry.name, specFile: rel });
    }
  }
  return out;
}
