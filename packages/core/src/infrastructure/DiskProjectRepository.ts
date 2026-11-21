import * as fs from "node:fs";
import * as path from "node:path";
import { IProjectRepository } from "../application/ports/IProjectRepository";
import { ArchivePlan } from "../domain/ArchivePlan";
import { paths, readConfig, taskProgress, listDeltas, listChangeFeatures } from "./ChangeWorkspace";

export class DiskProjectRepository implements IProjectRepository {
  constructor(private projectDir: string) {}

  public changeExists(changeId: string): boolean {
    const p = this.getPaths();
    return fs.existsSync(p.change(changeId));
  }

  public isChangeSymlink(changeId: string): boolean {
    const p = this.getPaths();
    const changeDir = p.change(changeId);
    return fs.existsSync(changeDir) && fs.lstatSync(changeDir).isSymbolicLink();
  }

  public readConfig(changeId: string): any {
    return readConfig(this.projectDir, changeId);
  }

  public getTaskProgress(changeId: string): { remaining: number; total: number } {
    return taskProgress(this.projectDir, changeId);
  }

  public listDeltas(
    changeId: string
  ): Array<{ file: string; relative: string; capability: string }> {
    return listDeltas(this.projectDir, changeId);
  }

  public listChangeFeatures(changeId: string): Array<{ file: string; relative: string }> {
    return listChangeFeatures(this.projectDir, changeId);
  }

  public readFile(absolutePath: string): string | null {
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  }

  public listFiles(absoluteDir: string): string[] {
    return fs.existsSync(absoluteDir)
      ? fs
          .readdirSync(absoluteDir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .sort()
      : [];
  }

  public getPaths() {
    return paths(this.projectDir);
  }

  public executePlan(plan: ArchivePlan): void {
    const undo: any[] = [];
    const restore = () => {
      for (const step of undo.reverse()) {
        try {
          if (step.type === "restore") fs.writeFileSync(step.file, step.contents, "utf8");
          else if (step.type === "unlink") fs.rmSync(step.file, { force: true });
          else if (step.type === "rename") fs.renameSync(step.from, step.to);
        } catch {
          // Best effort
        }
      }
    };

    try {
      for (const write of plan.writes) {
        fs.mkdirSync(path.dirname(write.file), { recursive: true });
        if (fs.existsSync(write.file)) {
          undo.push({
            type: "restore",
            file: write.file,
            contents: fs.readFileSync(write.file, "utf8"),
          });
        } else {
          undo.push({ type: "unlink", file: write.file });
        }
        fs.writeFileSync(write.file, write.contents, "utf8");
      }

      for (const del of plan.deletes) {
        if (fs.existsSync(del.file)) {
          undo.push({
            type: "restore",
            file: del.file,
            contents: fs.readFileSync(del.file, "utf8"),
          });
          fs.rmSync(del.file, { force: true });
        }
      }

      if (plan.move) {
        fs.mkdirSync(path.dirname(plan.move.to), { recursive: true });
        fs.renameSync(plan.move.from, plan.move.to);
        undo.push({ type: "rename", from: plan.move.to, to: plan.move.from });
      }
    } catch (err) {
      restore();
      throw err;
    }
  }
}
