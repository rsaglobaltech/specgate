import * as path from "node:path";

import { DeltaSpec } from "../domain/DeltaSpec";
import { Diagnostic, error, warning } from "../domain/Diagnostic";
import { LAYERED_SCHEMA, LEGACY_DISCOVER, checkLayers } from "../domain/ChangeLayers";
import { IProjectRepository } from "./ports/IProjectRepository";

export interface ValidateChangeOptions {
  /** Hold deltas to the stricter rules `specgate validate --strict-tdd` applies. */
  strict?: boolean;
}

export interface ValidateChangeResult {
  changeId: string;
  deltaCount: number;
  diagnostics: Diagnostic[];
}

/**
 * Is this change well-formed?
 *
 * A change is a proposal plus zero or more delta specs. Zero is a warning
 * rather than an error, because `skip_specs` is a legitimate way to record a
 * change that alters no requirement — and a project that sets it should not be
 * nagged. Each delta is then checked against the capability spec it amends,
 * which is what catches a `MODIFIED` of a requirement that does not exist.
 */
export class ValidateChangeUseCase {
  constructor(private projectRepo: IProjectRepository) {}

  public execute(changeId: string, opts: ValidateChangeOptions = {}): ValidateChangeResult {
    const paths = this.projectRepo.getPaths();
    const diagnostics: Diagnostic[] = [];
    const config = this.projectRepo.readConfig(changeId);

    // ADR-0041: the Discover is discover.md; a 0.27 change's is its proposal.
    const dir = paths.change(changeId);
    const read = (f: string) => this.projectRepo.readFile(path.join(dir, f));
    const discoverFile = read("discover.md") !== null ? "discover.md" : LEGACY_DISCOVER;
    const discover = read(discoverFile);
    if (discover === null) {
      const wanted = config.schema === LAYERED_SCHEMA ? "discover.md" : LEGACY_DISCOVER;
      diagnostics.push(
        error("missing_proposal", `Change "${changeId}" has no ${wanted}.`, {
          target: changeId,
          fix: `Create ${path.join("docs/specs/changes", changeId, wanted)}.`,
        })
      );
    } else {
      diagnostics.push(
        ...checkLayers({
          changeId,
          discover,
          discoverFile,
          design: read("design.md"),
          tasks: read("tasks.md"),
        })
      );
    }

    const deltas = this.projectRepo.listDeltas(changeId);
    if (deltas.length === 0 && !config.skip_specs) {
      diagnostics.push(
        warning("no_deltas", `Change "${changeId}" carries no delta specs.`, {
          target: changeId,
          fix: "Add a delta under specs/<capability>/spec.md, or set skip_specs: true.",
        })
      );
    }

    for (const entry of deltas) {
      const deltaSource = this.projectRepo.readFile(entry.file);
      if (deltaSource === null) continue;
      const { diagnostics: d } = DeltaSpec.validate(deltaSource, {
        specSource: this.projectRepo.readFile(paths.capabilitySpec(entry.capability)),
        file: entry.relative,
        strict: opts.strict,
      });
      diagnostics.push(...d);
    }

    return { changeId, deltaCount: deltas.length, diagnostics };
  }
}
