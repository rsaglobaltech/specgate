/**
 * REQ-649: a gate with no test command proves nothing, and the harness says
 * `unverified`. A test about something else — budgets, lanes, events — gives
 * the gate a command that passes, unless the project it runs on sets its own
 * (`test_cmd:` in harness.config.yaml), which is the one that must run.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export function gateTestCmd(projectDir: string): string[] {
  const config = path.join(projectDir, "harness.config.yaml");
  if (fs.existsSync(config) && /^test_cmd:/m.test(fs.readFileSync(config, "utf8"))) return [];
  return ["--test-cmd", "node -e 0"];
}
