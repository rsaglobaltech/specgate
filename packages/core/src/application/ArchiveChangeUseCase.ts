import * as path from "node:path";
import { renderDeltaFeature, withDefaultFeaturePaths } from "../domain/DeltaFeature";
import { IProjectRepository } from "./ports/IProjectRepository";
import { ArchivePlan } from "../domain/ArchivePlan";
import { DeltaSpec } from "../domain/DeltaSpec";
import { TraceabilityMatrix } from "../domain/TraceabilityMatrix";
import { parseDelta } from "../domain/SpecParser";
import { error, warning } from "../domain/Diagnostic";

export class ArchiveChangeUseCase {
  constructor(private repo: IProjectRepository) {}

  public execute(changeId: string, opts?: any): ArchivePlan {
    const o = opts || {};
    const plan = new ArchivePlan();

    if (!this.repo.changeExists(changeId)) {
      plan.diagnostics.push(
        error("archive_change_not_found", `Change "${changeId}" does not exist.`, {
          target: changeId,
          fix: `Run \`specgate change list\` to see active changes.`,
        })
      );
      return plan;
    }
    if (this.repo.isChangeSymlink(changeId)) {
      plan.diagnostics.push(
        error("archive_change_symlink", `Change "${changeId}" is a symlink; refusing to archive.`, {
          target: changeId,
          fix: "Replace the symlink with a real directory.",
        })
      );
      return plan;
    }

    const config = this.repo.readConfig(changeId);
    const progress = this.repo.getTaskProgress(changeId);

    if (progress.remaining > 0 && !o.force) {
      plan.diagnostics.push(
        error(
          "archive_tasks_incomplete",
          `Change "${changeId}" still has ${progress.remaining} unchecked task(s).`,
          {
            target: changeId,
            fix: "Finish the tasks, or pass --force to archive anyway.",
          }
        )
      );
    }

    const deltas = config.skip_specs ? [] : this.repo.listDeltas(changeId);

    if (!config.skip_specs && deltas.length === 0) {
      plan.warnings.push(
        warning("archive_no_deltas", `Change "${changeId}" carries no delta specs.`, {
          target: changeId,
          fix: "Set `skip_specs: true` in change.yaml if this change does not alter behaviour.",
        })
      );
    }

    const applied = { upserts: [] as any[], removals: [] as string[] };
    const p = this.repo.getPaths();

    // A change that brings no .feature files gets one per requirement with
    // scenarios, rendered from the delta (#46). One that brings its own keeps
    // the mapping its author chose.
    const bringsFeatures = this.repo.listChangeFeatures(changeId).length > 0;
    for (const entry of deltas) {
      const raw = this.repo.readFile(entry.file) || "";
      const deltaSource = bringsFeatures ? raw : withDefaultFeaturePaths(raw, entry.capability);
      const specFile = p.capabilitySpec(entry.capability);
      const specSource = this.repo.readFile(specFile);

      const { diagnostics: deltaDiags } = DeltaSpec.validate(deltaSource, {
        specSource,
        file: entry.relative,
      });

      for (const d of deltaDiags) {
        if (d.severity === "error") plan.diagnostics.push(d);
        else plan.warnings.push(d);
      }
      if (deltaDiags.some((d: any) => d.severity === "error")) continue;

      const merged = DeltaSpec.apply(specSource, deltaSource, {
        title: this.capabilityTitle(entry.capability),
      });

      plan.totals.added += merged.applied.added.length;
      plan.totals.modified += merged.applied.modified.length;
      plan.totals.removed += merged.applied.removed.length;

      const parsedDelta = parseDelta(deltaSource);
      for (const req of [...parsedDelta.added, ...parsedDelta.modified]) {
        applied.upserts.push({ req, capability: entry.capability });
      }
      for (const req of parsedDelta.removed) {
        applied.removals.push(req.id || req.name);
      }

      if (merged.retired) {
        if (config.retire_capabilities) {
          plan.deletes.push({ file: specFile, reason: "capability_retired" });
          plan.totals.specsRetired++;
          plan.warnings.push(
            warning(
              "archive_capability_retired",
              `Capability "${entry.capability}" lost its last requirement and its spec was deleted.`,
              {
                target: entry.capability,
                file: path.relative(p.root, specFile),
                fix: `Recover with: git checkout HEAD -- ${path.relative(p.root, specFile)}`,
              }
            )
          );
        } else {
          plan.diagnostics.push(
            error(
              "archive_retire_not_declared",
              `Change "${changeId}" removes the last requirement of "${entry.capability}" but does not declare retire_capabilities.`,
              {
                target: entry.capability,
                fix: "Set `retire_capabilities: true` in change.yaml to confirm the capability should disappear.",
              }
            )
          );
        }
      } else {
        plan.writes.push({ file: specFile, contents: merged.markdown, kind: "spec" });
        plan.totals.specsWritten++;
      }
    }

    for (const feature of this.repo.listChangeFeatures(changeId)) {
      const target = path.join(p.root, "features", feature.relative);
      if (this.repo.readFile(target) !== null && !o.force) {
        plan.warnings.push(
          warning(
            "archive_feature_exists",
            `features/${feature.relative} already exists and was left untouched.`,
            {
              target: `features/${feature.relative}`,
              fix: "Delete or merge the existing file, or re-run with --force to overwrite.",
            }
          )
        );
        continue;
      }
      plan.writes.push({
        file: target,
        contents: this.repo.readFile(feature.file) || "",
        kind: "feature",
      });
    }

    // A requirement whose trace names a feature file that neither exists nor
    // came with the change gets one rendered from the delta's own scenarios.
    // An author's `.feature` in the change folder, or a file already in the
    // project, always wins.
    const featureTargets = new Set(
      plan.writes.filter((w: any) => w.kind === "feature").map((w: any) => w.file)
    );
    for (const { req, capability } of applied.upserts) {
      const rel = String((req.trace || {}).feature || "")
        .replace(/`/g, "")
        .trim();
      if (!rel.endsWith(".feature") || !(req.scenarios || []).length) continue;
      const target = path.join(p.root, rel);
      if (featureTargets.has(target) || this.repo.readFile(target) !== null) continue;
      plan.writes.push({
        file: target,
        contents: renderDeltaFeature(req, capability),
        kind: "feature",
      });
      featureTargets.add(target);
    }

    let traceTotals = { added: 0, updated: 0, removed: 0, legacyDropped: 0 };
    if (applied.upserts.length > 0 || applied.removals.length > 0) {
      const existingContent = this.repo.readFile(p.traceability);
      const synced = TraceabilityMatrix.syncTraceability(existingContent, applied);
      traceTotals = synced.totals;
      plan.writes.push({ file: p.traceability, contents: synced.markdown, kind: "traceability" });
      if (synced.totals.legacyDropped > 0) {
        plan.warnings.push(
          warning(
            "traceability_upgraded",
            `traceability.md used the legacy 4-column format; ${synced.totals.legacyDropped} row(s) could not be carried over.`,
            {
              file: path.relative(p.root, p.traceability),
              fix: "Re-add those rows in the 10-column format, or restore from git and migrate by hand.",
            }
          )
        );
      }
    }
    plan.totals.traceability = traceTotals;

    const archivedAs = `${o.stamp || this.todayStamp(o.now)}-${changeId}`;
    plan.move = { from: p.change(changeId), to: path.join(p.archive, archivedAs) };

    if (this.repo.readFile(plan.move.to) !== null || this.repo.changeExists(plan.move.to)) {
      plan.diagnostics.push(
        error("archive_target_exists", `Archive entry "${archivedAs}" already exists.`, {
          target: archivedAs,
          fix: "Rename the change, or remove the existing archive entry.",
        })
      );
    }

    return plan;
  }

  private capabilityTitle(capability: string): string {
    return String(capability)
      .split("/")
      .map((part) => part.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()))
      .join(" / ");
  }

  private todayStamp(now?: Date): string {
    const d = now instanceof Date ? now : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
