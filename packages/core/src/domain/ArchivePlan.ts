import type { Diagnostic } from "./Diagnostic";

export interface WriteOperation {
  file: string;
  contents: string;
  kind: "spec" | "feature" | "traceability" | "use-cases" | "state-machines";
}

export interface DeleteOperation {
  file: string;
  reason: string;
}

export interface MoveOperation {
  from: string;
  to: string;
}

export interface ArchivePlanTotals {
  added: number;
  modified: number;
  removed: number;
  specsWritten: number;
  specsRetired: number;
  /** The use cases the change brought into docs/specs/use-cases.md (REQ-625). */
  useCases?: { added: number; modified: number; removed: number };
  /** The state machines the change wrote or removed (REQ-638). */
  stateMachines?: { written: number; removed: number };
  traceability?: {
    added: number;
    updated: number;
    removed: number;
    legacyDropped: number;
  };
}

export class ArchivePlan {
  public writes: WriteOperation[] = [];
  public deletes: DeleteOperation[] = [];
  public move?: MoveOperation;
  public totals: ArchivePlanTotals = {
    added: 0,
    modified: 0,
    removed: 0,
    specsWritten: 0,
    specsRetired: 0,
  };

  public projectDir?: string;
  public diagnostics: Diagnostic[] = [];
  public warnings: Diagnostic[] = [];

  public get ok(): boolean {
    return this.diagnostics.length === 0;
  }

  public get specsUpdated(): boolean {
    return this.totals.specsWritten > 0 || this.totals.specsRetired > 0;
  }
}
