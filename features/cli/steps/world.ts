"use strict";
import { setWorldConstructor, setDefaultTimeout } from "@cucumber/cucumber";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// CI on slower runners (Node 18, macOS) can exceed the 5s default per step.
// Bump to 30s — matches the spawnSync timeout below.
setDefaultTimeout(30_000);

const ROOT = path.resolve(__dirname, "../../../..");
const CLI = path.join(ROOT, "bin", "specgate.js");

const BASE_CONFIG = `PROJECT_NAME="BDD Test Project"
PROJECT_SLUG="bdd-test-project"
PROJECT_TYPE="backend"
DOMAIN="testing"
STACK="Node.js 20"
API_STYLE="REST"
TESTING="Jest"
DOCKER_SUPPORT="false"
DEVCONTAINER_SUPPORT="false"
`;

class CliWorld {
  tmpDir: string;
  configPath: string;
  outDir: string;
  projectDir: string;
  result: any;

  constructor() {
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-bdd-"));
    this.configPath = path.join(this.tmpDir, "project.config");
    this.outDir = path.join(this.tmpDir, "out");
    this.projectDir = path.join(this.outDir, "bdd-test-project");
    this.result = null;
    fs.writeFileSync(this.configPath, BASE_CONFIG);
    fs.mkdirSync(this.outDir, { recursive: true });
  }

  run(args: string[]) {
    this.result = spawnSync("node", [CLI, ...args], {
      encoding: "utf8",
      cwd: ROOT,
      timeout: 30000,
    });
    return this.result;
  }

  runInit(extra: string[] = []) {
    return this.run([
      "init",
      "--config",
      this.configPath,
      "--out",
      this.outDir,
      "--force",
      "--no-git",
      ...extra,
    ]);
  }

  writeConfig(content: string) {
    fs.writeFileSync(this.configPath, content);
  }

  cleanup() {
    fs.rmSync(this.tmpDir, { recursive: true, force: true });
  }
}

setWorldConstructor(CliWorld);
