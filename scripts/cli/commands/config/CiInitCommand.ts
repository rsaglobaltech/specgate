import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { renderTemplate } from "../../../../packages/core/src/domain/PackSpec";
import { BaseCommand } from "../../../lib/command";

import { findCliRoot } from "../../../lib/project-root";

const ROOT_DIR = findCliRoot(__dirname);
const CI_TEMPLATES = path.join(ROOT_DIR, "templates", "ci");
const packageJson = require(path.join(ROOT_DIR, "package.json"));

export const PROVIDERS: Record<string, { template: string; dest: string }> = {
  github: { template: "github.yml.tpl", dest: ".github/workflows/spec-gate.yml" },
  gitlab: { template: "gitlab.yml.tpl", dest: ".gitlab-ci.yml" },
  azure: { template: "azure.yml.tpl", dest: "azure-pipelines.yml" },
  jenkins: { template: "jenkins.tpl", dest: "Jenkinsfile" },
};

/**
 * The provider a repository already shows: its CI files first, then where
 * `origin` points. `init` ends by suggesting `specgate ci init`, which used to
 * answer "--provider is required" — the first step of the loop's own advice
 * was a usage error.
 */
export function detectProvider(projectDir: string): { provider: string; from: string } | null {
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  if (has(".github/workflows")) return { provider: "github", from: ".github/workflows/" };
  if (has(".gitlab-ci.yml")) return { provider: "gitlab", from: ".gitlab-ci.yml" };
  if (has("azure-pipelines.yml")) return { provider: "azure", from: "azure-pipelines.yml" };
  if (has("Jenkinsfile")) return { provider: "jenkins", from: "Jenkinsfile" };
  const remote = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  const url = remote.status === 0 ? remote.stdout.trim() : "";
  if (/github\.com[:/]/.test(url)) return { provider: "github", from: "the origin remote" };
  if (/gitlab\./.test(url)) return { provider: "gitlab", from: "the origin remote" };
  if (/dev\.azure\.com|visualstudio\.com/.test(url))
    return { provider: "azure", from: "the origin remote" };
  return null;
}

function logInfo(msg: string) {
  process.stdout.write(`ℹ️ [INFO] ${msg}\n`);
}
function logError(msg: string) {
  process.stderr.write(`❌ [ERROR] ${msg}\n`);
}
function logFix(msg: string) {
  process.stderr.write(`💡 [FIX] ${msg}\n`);
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate ci init [--provider <provider>] [options]\n\n" +
      `Providers: ${Object.keys(PROVIDERS).join(" | ")}\n\n` +
      "Options:\n" +
      "  --provider <name>    CI provider (default: detected from the repository's CI\n" +
      "                       files or its origin remote)\n" +
      "  --project-dir <dir>  Repository root (default: current directory)\n" +
      "  --stdout             Print the config instead of writing it\n" +
      "  --force              Overwrite the destination file if it exists\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts = {
    provider: null as string | null,
    projectDir: process.cwd(),
    stdout: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider" && argv[i + 1]) opts.provider = argv[++i];
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = path.resolve(argv[++i]);
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else {
      logError(`Unknown argument: ${a}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

export class CiInitCommand extends BaseCommand {
  public execute(): void {
    let rawArgs = this.args;
    if (rawArgs[0] === "ci") rawArgs = rawArgs.slice(1);
    if (rawArgs[0] === "init") rawArgs = rawArgs.slice(1);

    const opts = parseArgs(rawArgs);

    if (!opts.provider) {
      const detected = detectProvider(opts.projectDir);
      if (detected) {
        opts.provider = detected.provider;
        // On stderr under --stdout: that output is the file, piped somewhere.
        const line = `provider: ${detected.provider} (detected from ${detected.from})`;
        if (opts.stdout) process.stderr.write(`ℹ️ [INFO] ${line}\n`);
        else logInfo(line);
      }
    }
    if (!opts.provider) {
      logError("--provider is required: nothing in this repository names its CI.");
      logFix(`Pick one: ci init --provider ${Object.keys(PROVIDERS).join(" | ")}`);
      process.exit(2);
    }
    const provider = PROVIDERS[opts.provider];
    if (!provider) {
      logError(`Unknown provider: ${opts.provider}`);
      logFix(`Supported providers: ${Object.keys(PROVIDERS).join(", ")}`);
      process.exit(2);
    }

    const rendered = renderTemplate(
      fs.readFileSync(path.join(CI_TEMPLATES, provider.template), "utf8"),
      { SPECGATE_VERSION: packageJson.version || "latest" }
    );

    if (opts.stdout) {
      process.stdout.write(rendered);
      process.exit(0);
    }

    const dest = path.join(opts.projectDir, provider.dest);
    if (fs.existsSync(dest) && !opts.force) {
      logError(`${provider.dest} already exists — refusing to overwrite.`);
      logFix("Re-run with --stdout and paste the spec-gate job into your existing config,");
      logFix("or pass --force to replace the file entirely.");
      process.exit(2);
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, rendered, "utf8");
    logInfo(`write ${provider.dest}`);
    logInfo("✅ CI gate installed. The job:");
    logInfo("  1. runs `validate . --strict` on every PR/MR (the L2 gate)");
    logInfo("  2. runs `validate --against-lock` when .specops.lock exists, so a");
    logInfo("     moved pack tag or an edited generated file fails the build");
    logInfo("  3. publishes `plan --format json` as the spec-plan artifact");
    logInfo("Commit the file and open a PR to see the gate in action.");
    process.exit(0);
  }
}
