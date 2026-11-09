import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { renderTemplate } from "../../../../packages/core/src/domain/PackSpec";
import { BaseCommand } from "../../../lib/command";

import { findCliRoot } from "../../../lib/project-root";
import {
  azureSetup,
  ciImage,
  containerSetup,
  describeTests,
  githubSetup,
  planCi,
} from "./CiToolchain";
import * as ui from "../../../lib/ui";
import { ciStatus, GATE_FILE, OLD_SPECS_YML } from "./CiStatus";

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
  process.stdout.write(ui.logLine(msg));
}
function logError(msg: string) {
  process.stderr.write(ui.fail(msg));
}
function logFix(msg: string) {
  process.stderr.write(`     ${ui.muted(msg)}\n`);
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
      "  --minimal            One job on Ubuntu running only `specgate check` (github)\n" +
      "  --replace            Replace the specs.yml an older `specgate init` wrote\n" +
      "  --force              Overwrite the destination file if it exists\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts = {
    provider: null as string | null,
    projectDir: process.cwd(),
    stdout: false,
    force: false,
    minimal: false,
    replace: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider" && argv[i + 1]) opts.provider = argv[++i];
    else if (a === "--project-dir" && argv[i + 1]) opts.projectDir = path.resolve(argv[++i]);
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--minimal") opts.minimal = true;
    else if (a === "--replace") opts.replace = true;
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

/**
 * The job for one provider. The toolchain comes from the project — a JDK for a
 * pom.xml, `npm ci` for a lockfile — so the gate can run the tests (#70).
 */
export function renderCi(providerName: string, projectDir: string, minimal = false): string {
  const provider = PROVIDERS[providerName];
  const version = packageJson.version || "latest";
  const plan = planCi(projectDir, version);
  const container = containerSetup(plan, projectDir);
  // --minimal is the one-step GitHub gate (REQ-459); the others are one job already.
  const template =
    minimal && providerName === "github" ? "github-minimal.yml.tpl" : provider.template;
  return renderTemplate(fs.readFileSync(path.join(CI_TEMPLATES, template), "utf8"), {
    SPECGATE_VERSION: version,
    GATE_CMD: plan.gateCmd,
    SETUP_STEPS:
      providerName === "azure" ? azureSetup(plan, projectDir) : githubSetup(plan, projectDir),
    CI_IMAGE: ciImage(plan),
    SETUP_SCRIPT:
      providerName === "jenkins"
        ? container.map((l) => `                    ${l}`).join("\n")
        : container.map((l) => `    - ${l.includes(": ") ? JSON.stringify(l) : l}`).join("\n"),
  });
}

export type GateWritten =
  | { written: true; provider: string; dest: string }
  | { written: false; provider: string; dest: string; why: "exists" | "old-specs" };

/**
 * The spec gate for this project, as `init` and `adopt` install it (REQ-455):
 * the provider the repository shows, GitHub when it shows none. A gate that
 * exists is never overwritten, nor an old specs.yml replaced without being asked.
 */
export function writeGate(
  projectDir: string,
  opts: { provider?: string | null; minimal?: boolean; replace?: boolean; force?: boolean } = {}
): GateWritten {
  const provider = opts.provider ?? detectProvider(projectDir)?.provider ?? "github";
  const dest = PROVIDERS[provider].dest;
  const at = (rel: string) => path.join(projectDir, rel);
  if (fs.existsSync(at(dest)) && !opts.force)
    return { written: false, provider, dest, why: "exists" };
  const old = provider === "github" && dest === GATE_FILE && fs.existsSync(at(OLD_SPECS_YML));
  if (old && !opts.replace) return { written: false, provider, dest, why: "old-specs" };
  fs.mkdirSync(path.dirname(at(dest)), { recursive: true });
  fs.writeFileSync(at(dest), renderCi(provider, projectDir, !!opts.minimal), "utf8");
  if (old) fs.rmSync(at(OLD_SPECS_YML));
  return { written: true, provider, dest };
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
        if (opts.stdout) process.stderr.write(`  ℹ  ${line}\n`);
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

    if (opts.minimal && opts.provider !== "github") {
      logError("--minimal is for GitHub: the other providers' gate is one job already.");
      process.exit(2);
    }
    const rendered = renderCi(opts.provider, opts.projectDir, opts.minimal);
    const plan = planCi(opts.projectDir, packageJson.version || "latest");

    if (opts.stdout) {
      process.stdout.write(rendered);
      process.exit(0);
    }

    const result = writeGate(opts.projectDir, opts);
    if (!result.written && result.why === "exists") {
      logError(`${provider.dest} already exists — refusing to overwrite.`);
      logFix("Re-run with --stdout and paste the spec-gate job into your existing config,");
      logFix("or pass --force to replace the file entirely.");
      process.exit(2);
    }
    if (!result.written) {
      // An old specs.yml: say what the gate adds, write nothing (REQ-461).
      const missing = ciStatus(opts.projectDir).checks.filter((c) => !c.present);
      logError(
        `${OLD_SPECS_YML} (from an older specgate init) is this project's CI — not replaced.`
      );
      logInfo("The spec gate would add:");
      for (const c of missing) logInfo(`  + ${c.label}`);
      logFix(`Replace it: specgate ci init --provider ${opts.provider} --replace`);
      process.exit(2);
    }
    process.stdout.write(ui.header("ci init", opts.provider));
    logInfo(`write ${provider.dest}${opts.replace ? ` (replaces ${OLD_SPECS_YML})` : ""}`);
    logInfo("✅ CI gate installed. On every PR/MR the job:");
    // `check` either way since REQ-456: with no tests yet it says how to add them.
    logInfo("  1. runs `specgate check` — the specification, then the tests, as locally");
    logInfo(`     ${describeTests(plan)}`);
    logInfo("  2. runs `validate --against-lock` when .specops.lock exists, so a");
    logInfo("     moved pack tag or an edited generated file fails the build");
    logInfo("  3. publishes `plan --format json` as the spec-plan artifact");
    logInfo("Commit the file and open a PR to see the gate in action.");
    process.exit(0);
  }
}
