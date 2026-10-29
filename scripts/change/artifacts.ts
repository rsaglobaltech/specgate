/**
 * The artefact dependency graph, and where a change currently stands in it.
 *
 * Its own module because both `change status` and `change instructions` need
 * it, and having the second require the first created an import cycle that
 * only showed up at runtime.
 *
 * Which artefacts exist is a house style, not a law: the graph comes from the
 * change's declared schema (`schema:` in `change.yaml`), so a team can fork
 * `bdd-first` — scenario before spec — or write its own. The semantics do not
 * change with it. Dependencies are enablers, not gates (ADR-0018): `blocked`
 * means "you have not written what this builds on yet", never "you are
 * forbidden from writing this".
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { paths, listDeltas } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import type { ChangeConfig } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { resolveSchema } from "../schema/registry";
import {
  LAYERED_SCHEMA,
  isUntouchedLayer,
  layer,
  type LayerId,
} from "../../packages/core/src/domain/ChangeLayers";
import type { SchemaArtifact } from "../schema/registry";

/** The default graph, still exported for callers that predate schemas. */
export const ARTIFACTS: SchemaArtifact[] = [
  { id: "proposal", generates: "proposal.md", requires: [] },
  { id: "specs", generates: "specs/**/spec.md", requires: ["proposal"] },
  { id: "design", generates: "design.md", requires: ["proposal"] },
  { id: "tasks", generates: "tasks.md", requires: ["specs", "design"] },
];

/**
 * The graph this change follows. An unknown or malformed schema falls back to
 * the default rather than failing: a change already in flight should not become
 * unreadable because someone deleted a schema file.
 */
export function artifactsFor(
  projectDir: string,
  config: ChangeConfig | null | undefined
): SchemaArtifact[] {
  const found = resolveSchema(projectDir, (config && config.schema) || "spec-driven");
  if (!found || !Array.isArray(found.schema.artifacts) || found.schema.artifacts.length === 0) {
    return ARTIFACTS;
  }
  return found.schema.artifacts;
}

/** One artefact of a change, and whether it can be worked on yet. */
export interface ArtifactStateEntry {
  id: string;
  /** The role that writes a layer (ADR-0042); absent for the other artifacts. */
  owner?: string;
  outputPath: string;
  status: "done" | "ready" | "blocked" | "skipped";
  requires: string[];
  missingDeps?: string[];
}

/**
 * Whether each artefact's output is present.
 *
 * Two are special. `specs` counts deltas rather than one file, because a change
 * may touch several capabilities. `feature` (in `bdd-first`) is written into
 * the project's own `features/` tree, not into the change directory.
 */
function outputsPresent(
  projectDir: string,
  changeId: string,
  artifacts: readonly SchemaArtifact[]
): Record<string, boolean> {
  const dir = paths(projectDir).change(changeId);
  const present: Record<string, boolean> = {};
  for (const a of artifacts) {
    if (a.id === "specs") {
      present[a.id] = listDeltas(projectDir, changeId).length > 0;
    } else if (a.generates.includes("*")) {
      // Globs resolve inside the change directory. Looking at the project tree
      // instead would mark `feature` done from day one in any repo that already
      // has a .feature file — the artefact means "the scenario this change
      // adds", not "the project has scenarios".
      present[a.id] = hasAnyFile(path.join(dir, a.generates.split("*")[0]));
    } else if (a.id === "discover" || a.id === "design" || a.id === "tasks") {
      // REQ-288: a layer still as `change new` wrote it is not written yet.
      const file = path.join(dir, a.generates);
      present[a.id] =
        fs.existsSync(file) &&
        !isUntouchedLayer(a.id as LayerId, fs.readFileSync(file, "utf8"), changeId);
    } else {
      present[a.id] = fs.existsSync(path.join(dir, a.generates));
    }
  }
  return present;
}

function hasAnyFile(dir: string): boolean {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export function artifactState(
  projectDir: string,
  changeId: string,
  config: ChangeConfig
): ArtifactStateEntry[] {
  const artifacts = artifactsFor(projectDir, config);
  const exists = outputsPresent(projectDir, changeId, artifacts);

  // A change that declares skip_specs satisfies the `specs` dependency without
  // creating anything — the artefact counts as done, not as missing.
  const skipped: Record<string, boolean> = { specs: config.skip_specs === true };
  // Lite rigor makes design optional in the same way.
  // A layered change always has a design: it is the architect's layer.
  if (config.rigor === "lite" && !exists.design && config.schema !== LAYERED_SCHEMA) {
    skipped.design = true;
  }

  const satisfied = (id: string) => exists[id] || skipped[id];

  return artifacts.map((a) => {
    const missingDeps = (a.requires || []).filter((dep) => !satisfied(dep));
    let status: ArtifactStateEntry["status"];
    if (skipped[a.id]) status = "skipped";
    else if (exists[a.id]) status = "done";
    else if (missingDeps.length > 0) status = "blocked";
    else status = "ready";
    const entry: ArtifactStateEntry = {
      id: a.id,
      ...(config.schema === LAYERED_SCHEMA &&
      (a.id === "discover" || a.id === "design" || a.id === "tasks")
        ? { owner: layer(a.id as LayerId).owner }
        : {}),
      outputPath: a.generates,
      status,
      requires: a.requires || [],
    };
    if (status === "blocked") entry.missingDeps = missingDeps;
    return entry;
  });
}
