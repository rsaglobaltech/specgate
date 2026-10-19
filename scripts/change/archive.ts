import * as path from "node:path";
import { DiskProjectRepository } from "../../packages/core/src/infrastructure/DiskProjectRepository";
import { ArchiveChangeUseCase } from "../../packages/core/src/application/ArchiveChangeUseCase";
import { TraceabilityMatrix } from "../../packages/core/src/domain/TraceabilityMatrix";
import type { ArchivePlan } from "../../packages/core/src/domain/ArchivePlan";

// These wrappers keep the signatures their callers already use, and take
// whatever the core functions they delegate to take.
type ArchiveOptions = Parameters<ArchiveChangeUseCase["execute"]>[1];
type AppliedDelta = Parameters<typeof TraceabilityMatrix.syncTraceability>[1];
type TracedRequirement = Parameters<typeof TraceabilityMatrix.traceRow>[0];

export function planArchive(projectDir: string, changeId: string, opts?: ArchiveOptions) {
  const repo = new DiskProjectRepository(projectDir);
  const useCase = new ArchiveChangeUseCase(repo);
  const plan = useCase.execute(changeId, opts);
  plan.projectDir = projectDir;
  return plan;
}

export function executeArchive(plan: ArchivePlan) {
  const repo = new DiskProjectRepository(plan.projectDir || ".");
  repo.executePlan(plan);
  const archivedAs = plan.move ? path.basename(plan.move.to) : undefined;
  return {
    archivedAs,
    specsUpdated: plan.totals.specsWritten > 0 || plan.totals.specsRetired > 0,
    totals: plan.totals,
    warnings: plan.warnings,
  };
}

export function syncTraceability(existing: string | null, applied: AppliedDelta) {
  return TraceabilityMatrix.syncTraceability(existing, applied);
}

export function traceRow(req: TracedRequirement) {
  return TraceabilityMatrix.traceRow(req);
}
