/**
 * `specops diff --as-change` — a pack version bump, expressed as intent.
 *
 * What counts as a change is domain (`core/domain/PackDelta`); loading a pack,
 * reading its Gherkin templates and writing the change folder are
 * infrastructure (`DiskPackDeltaRepository`). This module wires the two and
 * keeps the signatures its callers and tests already use: `deriveDelta` takes
 * pack roots, and `materialiseChange` takes a project directory, with the
 * project's phrase table resolved here rather than deep inside the renderer.
 */

import { phrases } from "../../packages/core/src/infrastructure/DiskLanguageRepository";
import {
  loadPackModel,
  stepsForScenario,
  materialiseChange as writeChange,
} from "../../packages/core/src/infrastructure/DiskPackDeltaRepository";
import { derivePackDelta } from "../../packages/core/src/domain/PackDelta";
import type { PackEntry } from "../../packages/core/src/domain/Lockfile";

/** What `deriveDelta` takes besides the two pack roots. */
export interface DeriveDeltaOptions {
  /** Whose language setting the generated prose follows. */
  projectDir?: string;
  /** Provenance stamped on each requirement, e.g. `pack:<id>@<version>`. */
  origin?: string;
}

/** What `materialiseChange` takes besides the derived delta. */
export interface MaterialiseOptions {
  /** Overrides the id derived from the pack and the two versions. */
  changeId?: string;
  dryRun?: boolean;
}

export {
  requirementsById,
  scenariosByRequirement,
  requirementFingerprint,
  renderRequirementBlock,
  changeIdFor,
  renderProposal,
  renderTasks,
  LoadedPack,
  ReadSteps,
} from "../../packages/core/src/domain/PackDelta";

export {
  loadPackModel,
  stepsForScenario,
} from "../../packages/core/src/infrastructure/DiskPackDeltaRepository";

/**
 * Compare two versions of a pack and produce the delta markdown plus a summary.
 *
 * @returns { capability, markdown, summary: {added[], modified[], removed[]} }
 *          `markdown` is null when nothing behavioural changed.
 */
export function deriveDelta(
  oldPackRoot: string | null,
  newPackRoot: string,
  packId: string,
  opts?: DeriveDeltaOptions
) {
  const options = opts || {};
  const oldPack = oldPackRoot ? loadPackModel(oldPackRoot, packId) : null;
  const newPack = loadPackModel(newPackRoot, packId);
  return derivePackDelta(
    oldPack,
    newPack,
    packId,
    phrases(options.projectDir),
    stepsForScenario,
    options
  );
}

/**
 * Materialise the derived delta as a change folder. Returns the list of files
 * written (or that would be written, when `dryRun`).
 */
export function materialiseChange(
  projectDir: string,
  entry: PackEntry,
  targetVersion: string,
  derived: ReturnType<typeof deriveDelta>,
  opts?: MaterialiseOptions
) {
  return writeChange(projectDir, entry, targetVersion, derived, phrases(projectDir), opts);
}
