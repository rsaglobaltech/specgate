import { ITraceabilityRepository } from "./ports/ITraceabilityRepository";
import { TraceabilityMatrix } from "../domain/TraceabilityMatrix";
import { parseTraceabilityRows } from "../domain/TraceabilityFormat";

export interface AddRequirementFields {
  requirement?: string;
  scenarioId?: string;
  featureFile?: string;
  useCase?: string;
  command?: string;
  aggregate?: string;
  event?: string;
  technicalArtifact?: string;
  testArtifact?: string;
  status?: string;
  [key: string]: any;
}

export interface AddRequirementResult {
  ok: boolean;
  reqId?: string;
  scenarioId?: string;
  error?: string;
}

export class AddRequirementUseCase {
  constructor(private traceRepo: ITraceabilityRepository) {}

  /**
   * `reservedUpTo`: the highest id number an open change has reserved. A new
   * id goes above it, so a requirement added while a change is open never takes
   * an id that change will use (ADR-0036).
   */
  public execute(
    projectDir: string,
    fields: AddRequirementFields,
    reservedUpTo = 0
  ): AddRequirementResult {
    const rawContent = this.traceRepo.readTraceability(projectDir) || "";
    const parsed = rawContent ? parseTraceabilityRows(rawContent) : { rows: [] };
    if (!fields.requirement && reservedUpTo > 0) {
      const next = Number(TraceabilityMatrix.nextReqId(parsed.rows || []).slice(4));
      const n = Math.max(next, reservedUpTo + 1);
      fields = { ...fields, requirement: `REQ-${String(n).padStart(3, "0")}` };
    }

    const result = TraceabilityMatrix.appendRequirement(rawContent, fields, parsed.rows || []);
    this.traceRepo.writeTraceability(projectDir, result.content);

    return {
      ok: true,
      reqId: result.reqId,
      scenarioId: result.scenarioId,
    };
  }
}
