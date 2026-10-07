import * as fs from "node:fs";
import * as path from "node:path";
import { IHarnessConfigRepository } from "../application/ports/IHarnessConfigRepository";
import { HarnessSettings } from "../domain/HarnessConfig";
import { readHarnessConfig } from "./HarnessConfigFile";

export class DiskHarnessConfigRepository implements IHarnessConfigRepository {
  public readConfig(projectDir: string): Partial<HarnessSettings> | null {
    return readHarnessConfig(projectDir);
  }

  public listProjectDir(projectDir: string, relativePath: string): string[] {
    try {
      return fs.readdirSync(path.resolve(projectDir, relativePath)).sort();
    } catch {
      return [];
    }
  }

  public readProjectFile(projectDir: string, relativePath: string): string | null {
    const fullPath = path.resolve(projectDir, relativePath);
    try {
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, "utf8");
      }
    } catch {
      // Ignored
    }
    return null;
  }
}
