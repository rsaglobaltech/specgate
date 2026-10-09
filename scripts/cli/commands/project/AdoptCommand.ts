import { mergeContract } from "../../../agents/contract-file";
import { installDetectedAgents } from "../../../agents/detect";
import * as fs from "node:fs";
import { migrateToDerived } from "../spec/MatrixCommand";
import * as path from "node:path";
import { renderTemplate } from "../../../../packages/core/src/domain/PackSpec";
import { slugify } from "./WizardCommand";
import { BaseCommand } from "../../../lib/command";
import type { Capability } from "./OnboardCommand";

import { findCliRoot } from "../../../lib/project-root";

import { detectTestCommand } from "../../../../packages/core/src/domain/TestCommand";

/**
 * `adopt` and `harness init` used to answer this differently on the same
 * `pom.xml`. One detector now, so a project gets one answer.
 */
function sharedTestCommand(dir: string): string {
  return (
    detectTestCommand({
      exists: (rel) => fs.existsSync(path.join(dir, rel)),
      read: (rel) => {
        try {
          return fs.readFileSync(path.join(dir, rel), "utf8");
        } catch {
          return null;
        }
      },
    }) || ""
  );
}

const ROOT_DIR = findCliRoot(__dirname);
const ADOPT_TEMPLATES = path.join(ROOT_DIR, "templates", "adopt");
const ADOPT_AGENTS_TEMPLATE = path.join(ROOT_DIR, "templates", "base", "AGENTS.md.tpl");

function logInfo(msg: string) {
  process.stdout.write(`ℹ️ [INFO] ${msg}\n`);
}
function logWarn(msg: string) {
  process.stdout.write(`⚠️ [WARN] ${msg}\n`);
}
function logError(msg: string) {
  process.stderr.write(`❌ [ERROR] ${msg}\n`);
}
function fail(msg: string, exitCode = 1): never {
  logError(msg);
  process.exit(exitCode);
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate adopt [--project-dir <dir>] [--dry-run] [--monorepo]\n" +
      "                 [--no-capabilities] [--var KEY=VALUE]...\n\n" +
      "Installs Spec-Driven Development on an existing repository:\n" +
      "- detects the stack from pom.xml / build.gradle / package.json / go.mod\n" +
      "- generates spec.md, AI_RULES.md, features/adoption/baseline.feature,\n" +
      "  docs/specs/traceability.md and docs/specs/adr/README.md\n" +
      "- seeds one proposed requirement per capability the layout implies\n" +
      "- never overwrites existing files and never modifies source code\n\n" +
      "Options:\n" +
      "  --project-dir <dir>  Repository to adopt (default: current directory)\n" +
      "  --dry-run            Print what would be written without writing\n" +
      "  --monorepo           Adopt every module the repository declares and write\n" +
      "                       the specops.config.yaml that `validate` reads\n" +
      "  --no-capabilities    Do not seed proposed requirements — skeleton only\n  --keep-matrix        Keep traceability.md hand-maintained instead of generated\n  --no-agents          Do not install the /specgate:* commands for the agents found here\n" +
      "  --var KEY=VALUE      Override a detected value (PROJECT_NAME, PROJECT_SLUG,\n" +
      "                       DOMAIN, STACK, API_STYLE, TESTING, TEST_CMD)\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts = {
    projectDir: process.cwd(),
    dryRun: false,
    monorepo: false,
    noCapabilities: false,
    keepMatrix: false,
    noAgents: false,
    vars: {} as Record<string, string>,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) {
      opts.projectDir = path.resolve(argv[++i]);
    } else if (a === "--dry-run") {
      opts.dryRun = true;
    } else if (a === "--monorepo") {
      opts.monorepo = true;
    } else if (a === "--no-capabilities") {
      opts.noCapabilities = true;
    } else if (a === "--keep-matrix") {
      opts.keepMatrix = true;
    } else if (a === "--no-agents") {
      opts.noAgents = true;
    } else if (a === "--var" && argv[i + 1]) {
      const pair = argv[++i];
      const eq = pair.indexOf("=");
      if (eq === -1) fail(`--var expects KEY=VALUE, got: ${pair}`, 2);
      opts.vars[pair.slice(0, eq)] = pair.slice(eq + 1);
    } else if (a === "--help" || a === "-h") {
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

function readIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

export function detectStack(dir: string) {
  const facts = {
    PROJECT_NAME: path.basename(dir),
    STACK: "unknown — edit AGENTS.md with your stack",
    TESTING: "unknown — edit AGENTS.md with your test toolchain",
    TEST_CMD: "echo 'configure your test command'",
    detected: "none",
  };

  const pom = readIfExists(path.join(dir, "pom.xml"));
  if (pom !== null) {
    const parts = ["Java"];
    const javaVersion =
      pom.match(/<java\.version>([^<]+)<\/java\.version>/) ||
      pom.match(/<maven\.compiler\.release>([^<]+)<\/maven\.compiler\.release>/);
    if (javaVersion) parts[0] = `Java ${javaVersion[1].trim()}`;
    if (pom.includes("spring-boot")) parts.push("Spring Boot");
    if (pom.includes("quarkus")) parts.push("Quarkus");
    if (pom.includes("hapi-fhir")) parts.push("HAPI FHIR");
    parts.push("Maven");
    const artifactId = pom.match(/<artifactId>([^<]+)<\/artifactId>/);
    const name = pom.match(/<name>([^<]+)<\/name>/);
    if (name) facts.PROJECT_NAME = name[1].trim();
    else if (artifactId) facts.PROJECT_NAME = artifactId[1].trim();
    facts.STACK = parts.join(", ");
    facts.TESTING = pom.includes("testcontainers") ? "JUnit 5, Testcontainers" : "JUnit 5";
    facts.TEST_CMD = sharedTestCommand(dir);
    facts.detected = "pom.xml";
    return facts;
  }

  const gradle =
    readIfExists(path.join(dir, "build.gradle")) ||
    readIfExists(path.join(dir, "build.gradle.kts"));
  if (gradle !== null) {
    const parts = [gradle.includes("kotlin") ? "Kotlin" : "Java"];
    if (gradle.includes("spring-boot") || gradle.includes("org.springframework.boot")) {
      parts.push("Spring Boot");
    }
    parts.push("Gradle");
    facts.STACK = parts.join(", ");
    facts.TESTING = "JUnit 5";
    facts.TEST_CMD = sharedTestCommand(dir);
    facts.detected = "build.gradle";
    return facts;
  }

  const pkgRaw = readIfExists(path.join(dir, "package.json"));
  if (pkgRaw !== null) {
    let pkg: any;
    try {
      pkg = JSON.parse(pkgRaw);
    } catch {
      logWarn("package.json is not valid JSON — falling back to generic Node.js facts.");
    }
    if (!pkg || typeof pkg !== "object") pkg = {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const parts = ["Node.js"];
    if (deps.typescript) parts.push("TypeScript");
    for (const fw of ["react", "vue", "@angular/core", "express", "fastify", "next"]) {
      if (deps[fw]) parts.push(fw.replace("@angular/core", "Angular"));
    }
    if (pkg.name) facts.PROJECT_NAME = String(pkg.name).replace(/^@[^/]+\//, "");
    facts.STACK = parts.join(", ");
    facts.TESTING = deps.vitest ? "Vitest" : deps.jest ? "Jest" : "npm test";
    facts.TEST_CMD = pkg.scripts && pkg.scripts.test ? "npm test" : facts.TEST_CMD;
    facts.detected = "package.json";
    return facts;
  }

  if (readIfExists(path.join(dir, "go.mod")) !== null) {
    facts.STACK = "Go";
    facts.TESTING = "go test";
    facts.TEST_CMD = "go test ./...";
    facts.detected = "go.mod";
    return facts;
  }

  // Python. A cold adoption on Flask reported `detected from none` with
  // `pyproject.toml` sitting in the root, so `Stack: unknown` propagated into
  // spec.md, AI_RULES.md and every capability proposal downstream. Meanwhile
  // `harness init`, in the same directory, wrote `test_cmd: pytest` — the two
  // halves of the tool disagreeing about what the project even is.
  const pyproject = readIfExists(path.join(dir, "pyproject.toml"));
  const setupPy = readIfExists(path.join(dir, "setup.py"));
  if (pyproject !== null || setupPy !== null) {
    const source = pyproject || setupPy || "";
    const parts = ["Python"];
    if (/\bdjango\b/i.test(source)) parts.push("Django");
    else if (/\bfastapi\b/i.test(source)) parts.push("FastAPI");
    else if (/\bflask\b/i.test(source)) parts.push("Flask");
    if (/\bpoetry\b/i.test(source)) parts.push("Poetry");
    else if (pyproject !== null) parts.push("pyproject");
    facts.STACK = parts.join(", ");
    // `tox.ini` means the project runs its suite through tox; saying `pytest`
    // there would be a guess that fails on the first run.
    const viaTox = readIfExists(path.join(dir, "tox.ini")) !== null;
    facts.TESTING = viaTox ? "tox" : "pytest";
    facts.TEST_CMD = viaTox ? "tox" : "pytest";
    facts.detected = pyproject !== null ? "pyproject.toml" : "setup.py";
    const nameMatch = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(source);
    if (nameMatch) facts.PROJECT_NAME = nameMatch[1].trim();
    return facts;
  }

  if (readIfExists(path.join(dir, "Cargo.toml")) !== null) {
    facts.STACK = "Rust, Cargo";
    facts.TESTING = "cargo test";
    facts.TEST_CMD = "cargo test";
    facts.detected = "Cargo.toml";
    return facts;
  }

  // .NET puts the manifest next to the code rather than at the root, so this
  // looks for one rather than reading a fixed name.
  const csproj = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => f.endsWith(".csproj") || f.endsWith(".sln"))
    : undefined;
  if (csproj) {
    facts.STACK = ".NET";
    facts.TESTING = "dotnet test";
    facts.TEST_CMD = "dotnet test";
    facts.detected = csproj;
    return facts;
  }

  return facts;
}

const ADOPT_FILES = [
  ["spec.md.tpl", "spec.md"],
  ["baseline.feature.tpl", "features/adoption/baseline.feature"],
  ["traceability.md.tpl", "docs/specs/traceability.md"],
  ["adr-readme.md.tpl", "docs/specs/adr/README.md"],
];

/**
 * Turn the capabilities `onboard` reads off the layout into seeded requirements.
 *
 * Without this the two commands do not speak: `onboard` proposes eight
 * capabilities with evidence and file counts, and then `adopt` throws them away
 * and writes a single placeholder. That seam is where adoption dies — measured
 * on `lixi-platform`, adopted months ago and still sitting on `REQ-001` while
 * the repository carries 297 tests.
 *
 * Every seeded requirement is labelled a proposal and starts `Draft` with a
 * `TBD` test, so nothing here claims to be specified or verified. It exists to
 * replace the blank page with eight arguable statements.
 */
export function buildProposedRequirements(capabilities: Capability[]) {
  if (capabilities.length === 0) return { spec: "", rows: "" };

  const spec = capabilities
    .map((cap, i) => {
      const id = `REQ-${String(i + 2).padStart(3, "0")}`;
      return (
        `\n## ${id} — ${cap.title}\n\n` +
        `**Proposed, not specified.** Read off \`${cap.evidence}\` ` +
        `(${cap.files} source file${cap.files === 1 ? "" : "s"}), which says this codebase has a\n` +
        `${cap.title} area — not what it must do. Replace this paragraph with one behaviour you\n` +
        `already rely on, add its scenario under \`features/${cap.id}/\`, then\n` +
        `\`specgate req link ${id} --code <path> --test <path>\`.\n`
      );
    })
    .join("");

  const rows = capabilities
    .map((cap, i) => {
      const id = `REQ-${String(i + 2).padStart(3, "0")}`;
      return `| ${id} | - | - | UC-${String(i + 2).padStart(3, "0")} ${cap.title} | - | - | - | \`${cap.evidence}\` | TBD | Draft |`;
    })
    .join("\n");

  return { spec, rows: `${rows}\n` };
}

interface AdoptOptions {
  projectDir: string;
  dryRun: boolean;
  monorepo: boolean;
  noCapabilities: boolean;
  noAgents?: boolean;
  vars: Record<string, string>;
}

/** Adopt one directory. */
function adoptOne(dir: string, opts: AdoptOptions, { quiet = false } = {}) {
  const say = quiet ? () => {} : logInfo;

  const detected = detectStack(dir);

  // Required lazily: OnboardCommand imports detectStack from this file, and a
  // top-level import would close the cycle.
  const capabilities: Capability[] = opts.noCapabilities
    ? []
    : (require("./OnboardCommand") as typeof import("./OnboardCommand")).proposeCapabilities(dir);
  const proposed = buildProposedRequirements(capabilities);

  const vars = {
    PROJECT_NAME: detected.PROJECT_NAME,
    PROJECT_SLUG: slugify(detected.PROJECT_NAME),
    DOMAIN: "general",
    STACK: detected.STACK,
    API_STYLE: "REST with DTO boundaries",
    TESTING: detected.TESTING,
    TEST_CMD: detected.TEST_CMD,
    PROPOSED_REQUIREMENTS: proposed.spec,
    PROPOSED_ROWS: proposed.rows,
    ...opts.vars,
  };

  say(
    `🔍 Stack detection: ${detected.detected === "none" ? "no build manifest found" : detected.detected}`
  );
  say(`- Project: ${vars.PROJECT_NAME}`);
  say(`- Stack: ${vars.STACK}`);
  say(`- Test command: ${vars.TEST_CMD}`);
  if (detected.detected === "none" && !quiet) {
    logWarn("Could not detect the stack — review AGENTS.md and traceability.md after adoption.");
  }

  let written = 0;
  let skipped = 0;
  for (const [tpl, dst] of ADOPT_FILES) {
    const dstPath = path.join(dir, dst);
    if (fs.existsSync(dstPath)) {
      if (!quiet) logWarn(`skip (exists): ${dst}`);
      skipped++;
      continue;
    }
    const rendered = renderTemplate(fs.readFileSync(path.join(ADOPT_TEMPLATES, tpl), "utf8"), vars);
    if (opts.dryRun) {
      say(`[dry-run] write ${dst}`);
    } else {
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.writeFileSync(dstPath, rendered, "utf8");
      say(`write ${dst}`);
    }
    written++;
  }

  // AGENTS.md: the agent contract (ADR-0031). A repository often has one
  // already; the contract goes in a marked block and the team's text stays.
  {
    const agentsPath = path.join(dir, "AGENTS.md");
    const existing = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf8") : null;
    const contract = renderTemplate(fs.readFileSync(ADOPT_AGENTS_TEMPLATE, "utf8"), {
      PROJECT_TYPE: "existing",
      ARCHITECTURE: "minimal",
      DOMAIN: "see spec.md",
      API_STYLE: "as built",
      ...vars,
      STACK_RULES: [
        `- The test command is \`${vars.TEST_CMD}\`.`,
        fs.readFileSync(path.join(ADOPT_TEMPLATES, "stack-rules.md"), "utf8").trimEnd(),
      ].join("\n"),
      ARCHITECTURE_MODELING_RULES:
        "- Keep business logic out of framework code: no business rules in controllers, components, or infrastructure adapters.",
      ARCHITECTURE_CHECKS: "",
    });
    if (opts.dryRun) {
      say(`[dry-run] ${existing === null ? "write" : "add the specgate block to"} AGENTS.md`);
    } else {
      fs.writeFileSync(agentsPath, mergeContract(existing, contract), "utf8");
      say(
        existing === null
          ? "write AGENTS.md"
          : "add the specgate block to AGENTS.md (your text kept)"
      );
    }
    written++;
  }

  if (!fs.existsSync(path.join(dir, "README.md")) && !opts.dryRun) {
    fs.writeFileSync(
      path.join(dir, "README.md"),
      `# ${vars.PROJECT_NAME}\n\nBuild and test: \`${vars.TEST_CMD}\`\n`,
      "utf8"
    );
    say("write README.md (was missing)");
    written++;
  }

  return { written, skipped, capabilities };
}

/**
 * `--monorepo`: adopt every module the repository declares, and write the
 * `specops.config.yaml` that puts `validate` into monorepo mode.
 *
 * The mode already existed (B8) but nothing generated its config, so the
 * documented path was "hand-write a projects list and run adopt once per
 * module". The module list is the same one `onboard` reads — a directory with
 * its own build manifest — so this is bookkeeping, not new inference.
 */
function adoptMonorepo(dir: string, opts: AdoptOptions): never {
  const { findDeclaredModules } = require("./OnboardCommand") as typeof import("./OnboardCommand");
  const modules = findDeclaredModules(dir);

  if (modules.length < 2) {
    fail(
      `--monorepo found ${modules.length} declared module(s) under ${dir}.\n` +
        "A module is a directory with its own build manifest (pom.xml, build.gradle,\n" +
        "package.json, Cargo.toml, go.mod, *.gemspec, *.csproj…).\n" +
        "Adopt this repository as a single project instead: specgate adopt",
      2
    );
  }

  logInfo(`🗂️ Monorepo: ${modules.length} declared module(s)`);
  let written = 0;
  let skipped = 0;
  const adopted: string[] = [];

  for (const mod of modules) {
    const rel = path.relative(dir, mod.dir).split(path.sep).join("/");
    if (fs.existsSync(path.join(mod.dir, "spec.md"))) {
      logWarn(`skip (already adopted): ${rel}`);
      adopted.push(rel);
      skipped++;
      continue;
    }
    logInfo(`── ${rel}`);
    const r = adoptOne(mod.dir, opts, { quiet: true });
    logInfo(
      `   ${opts.dryRun ? "[dry-run] " : ""}${r.written} file(s), ${r.capabilities.length} capability requirement(s) seeded`
    );
    written += r.written;
    adopted.push(rel);
  }

  const cfgPath = path.join(dir, "specops.config.yaml");
  if (fs.existsSync(cfgPath)) {
    logWarn("skip (exists): specops.config.yaml — check its projects: list covers every module");
    skipped++;
  } else {
    const body =
      "# Monorepo layout for `specgate validate .` — one entry per adopted module.\n" +
      "# Generated by `specgate adopt --monorepo`; edit freely.\n" +
      "projects:\n" +
      adopted.map((rel) => `  - path: ${rel}\n`).join("");
    if (opts.dryRun) {
      logInfo("[dry-run] write specops.config.yaml");
    } else {
      fs.writeFileSync(cfgPath, body, "utf8");
      logInfo("write specops.config.yaml");
    }
    written++;
  }

  logInfo("📋 Summary");
  logInfo(`- Files written: ${written}${opts.dryRun ? " (dry-run, nothing on disk)" : ""}`);
  logInfo(`- Skipped: ${skipped}`);
  logWarn("This does not certify your code yet — it certifies the skeleton.");
  logInfo("  A green `validate` right now means the structure is in place, not that any");
  logInfo("  behaviour is covered. It starts meaning something when the requirements below");
  logInfo("  are real and their scenarios are linked to tests.");
  logInfo("✅ Adoption completed. Next steps:");
  logInfo("  1. specgate validate .          # validates every module listed");
  logInfo("  2. Replace the seeded proposals in each module's spec.md with real behaviour");
  logInfo("  3. Add `validate . --strict` to CI to lock the gate in");
  installDetectedAgents(dir, { dryRun: opts.dryRun, skip: opts.noAgents }, logInfo);
  process.exit(0);
}

export class AdoptProjectCommand extends BaseCommand {
  public execute() {
    let rawArgs = this.args;
    if (rawArgs[0] === "adopt") rawArgs = rawArgs.slice(1);
    const opts = parseArgs(rawArgs);
    const dir = opts.projectDir;

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      fail(`Directory not found: ${dir}`, 2);
    }

    if (opts.monorepo) adoptMonorepo(dir, opts);

    if (fs.existsSync(path.join(dir, "spec.md"))) {
      fail(
        `${path.join(dir, "spec.md")} already exists — this repository looks spec-driven already.\n` +
          "Run `specgate status` to see what is left, `specgate check` to gate it,\n" +
          "or remove spec.md to re-adopt.",
        2
      );
    }

    const { written, skipped, capabilities } = adoptOne(dir, opts);
    // A new adoption starts with a generated matrix: nobody maintains it,
    // `done` and `new` write spec.md, and the gate keeps it honest.
    if (!opts.dryRun && !opts.keepMatrix && migrateToDerived(dir)) {
      logInfo("- Traceability: generated from spec.md, tags and tests (`specgate matrix`)");
    }

    logInfo("📋 Summary");
    logInfo(`- Files written: ${written}${opts.dryRun ? " (dry-run, nothing on disk)" : ""}`);
    logInfo(`- Files skipped (already present): ${skipped}`);
    if (capabilities.length > 0) {
      logInfo(
        `- Requirements seeded: ${capabilities.length} proposal(s) from the layout — ${capabilities.map((c) => c.id).join(", ")}`
      );
    }
    logWarn("This does not certify your code yet — it certifies the skeleton.");
    logInfo("  A green `validate` right now means the structure is in place, not that any");
    logInfo("  behaviour is covered. It starts meaning something when the requirements below");
    logInfo("  are real and their scenarios are linked to tests.");
    logInfo("✅ Adoption completed. Next steps:");
    logInfo("  1. specgate check               # the gate — should pass right now");
    if (capabilities.length > 0) {
      logInfo("  2. Argue with the seeded proposals in spec.md — each one names its evidence");
    } else {
      logInfo('  2. specgate new "<behaviour>"   # one requirement you already rely on');
    }
    logInfo("  3. specgate status              # what each requirement still needs");
    logInfo("  4. specgate ci init             # put the gate in CI");
    installDetectedAgents(dir, { dryRun: opts.dryRun, skip: opts.noAgents }, logInfo);
    process.exit(0);
  }
}
