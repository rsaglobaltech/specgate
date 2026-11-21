import { ArchivePlan } from "../../domain/ArchivePlan";

export interface IProjectRepository {
  changeExists(changeId: string): boolean;
  isChangeSymlink(changeId: string): boolean;
  readConfig(changeId: string): any;
  getTaskProgress(changeId: string): { remaining: number; total: number };
  listDeltas(changeId: string): Array<{ file: string; relative: string; capability: string }>;
  listChangeFeatures(changeId: string): Array<{ file: string; relative: string }>;
  readFile(absolutePath: string): string | null;
  /** The names of the files in a folder; [] when there is none (REQ-638). */
  listFiles?(absoluteDir: string): string[];
  getPaths(): any;
  executePlan(plan: ArchivePlan): void;
}
