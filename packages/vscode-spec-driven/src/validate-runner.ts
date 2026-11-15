import { spawnSync } from "node:child_process";

export interface ValidateResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  spawnError: string | null;
}

export class ValidateRunner {
  private cliPath: string;

  constructor(cliPath: string = "npx @rsaglobaltech/specgate") {
    this.cliPath = cliPath;
  }

  public runValidate(projectDir: string): ValidateResult {
    const parts = this.cliPath.trim().split(/\s+/);
    const cmd = parts[0];
    const prefixArgs = parts.slice(1);

    const result = spawnSync(cmd, [...prefixArgs, "validate", projectDir], {
      encoding: "utf8",
      timeout: 30_000,
      shell: process.platform === "win32",
    });

    return {
      exitCode: typeof result.status === "number" ? result.status : 1,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      spawnError: result.error ? result.error.message : null,
    };
  }
}

// Legacy export
export const runValidate = (projectDir: string, cliPath?: string) => {
  return new ValidateRunner(cliPath).runValidate(projectDir);
};
