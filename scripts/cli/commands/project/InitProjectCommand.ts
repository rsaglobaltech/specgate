import { mergeContract } from "../../../agents/contract-file";
import { installDetectedAgents } from "../../../agents/detect";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../../../packages/core/src/domain/YamlLite";
import { runInitWizard, defaultAnswers, renderConfigYaml } from "./WizardCommand";
import { BaseCommand } from "../../../lib/command";
import {
  planStacks,
  renderSpecopsConfig,
  relativeToRoot,
  SHARED_PATHS,
  InvalidStackList,
} from "../../../../packages/core/src/domain/MultiStack";

import { findCliRoot } from "../../../lib/project-root";
import { AdoptProjectCommand, detectStack } from "./AdoptCommand";
import { migrateToDerived } from "../spec/MatrixCommand";

const ROOT_DIR = findCliRoot(__dirname);
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");

export const PROJECT_TYPES = ["backend", "frontend", "mobile"];

/**
 * How much architectural vocabulary a project asks to be scaffolded with.
 *
 * ADR-0022: patterns are optional, principles are not. The gate is identical
 * for all three — `validate` never asks which profile a project chose — so this
 * decides what `init` writes and what the agent's rulebook demands, nothing
 * more.
 */
export const ARCHITECTURES = ["minimal", "layered", "tactical-ddd"];

/**
 * Domain documents each profile keeps. Every profile is a subset of the one
 * below it, which is why raising a profile is additive and lowering it is not.
 */
export const ARCHITECTURE_DOCS: Record<string, string[]> = {
  minimal: [],
  layered: ["use-cases.md"],
  "tactical-ddd": [
    "domain-model.md",
    "use-cases.md",
    "commands.md",
    "aggregates.md",
    "events.md",
    "status-model.md",
  ],
};

/** Every domain document `templates/base` ships, so the rest can be removed. */
const ALL_DOMAIN_DOCS = ARCHITECTURE_DOCS["tactical-ddd"];

/**
 * The agent's rulebook, per profile.
 *
 * This is where the obligation people actually feel lives. `validate` never
 * asks for an aggregate; `AGENTS.md` does, on every prompt, and the agent
 * obeys prose no machine checks. So the profile has to reach here or it changes
 * nothing that matters (ADR-0022).
 *
 * Two lines appear in every profile because they are principles rather than
 * patterns: work is traceable, and business logic stays out of framework code.
 * The second is not DDD — a business rule inside a controller is equally wrong
 * without aggregates — and it is the part teams believe DDD is giving them.
 */
/**
 * The stack's own rules, one line each, for the `## Project rules` section of
 * AGENTS.md (ADR-0031). They were the body of a separate AI_RULES.md.
 */
export function stackRules(projectType: string): string {
  const file = path.join(TEMPLATES_DIR, projectType, "stack-rules.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trimEnd() : "";
}

export function architectureSections(cfg: any): Record<string, string> {
  const profile = cfg.ARCHITECTURE;
  const isFrontend = cfg.PROJECT_TYPE === "frontend" || cfg.PROJECT_TYPE === "mobile";
  const target = isFrontend
    ? "aggregate, read model, or UI state model"
    : "aggregate or read model";

  const invariantRules = [
    "- Do not implement anything that has no requirement and no scenario.",
    "- Keep business logic out of framework code: no business rules in controllers, components, or infrastructure adapters.",
    "- If a new business rule appears during implementation, update the feature scenario first.",
  ];

  const modeling: Record<string, string[]> = {
    minimal: invariantRules,
    layered: [
      "- Do not implement a flow that is not listed in `docs/specs/use-cases.md` or `docs/specs/traceability.md`.",
      ...invariantRules,
    ],
    "tactical-ddd": [
      "- Do not implement a use case that is not listed in `docs/specs/use-cases.md` or `docs/specs/traceability.md`.",
      "- Do not create a command without mapping it to a use case.",
      "- Do not emit a domain event that is not listed in `docs/specs/events.md`.",
      "- Keep domain logic independent from HTTP, database, queues, and framework code.",
      ...invariantRules,
    ],
  };

  const invariantGates = ["- [ ] Requirement has ID.", "- [ ] Scenario has ID."];
  const gates: Record<string, string[]> = {
    minimal: [...invariantGates, "- [ ] Traceability row is complete."],
    layered: [
      ...invariantGates,
      "- [ ] Scenario maps to a use case.",
      "- [ ] Traceability row is complete.",
    ],
    "tactical-ddd": [
      ...invariantGates,
      "- [ ] Scenario maps to a use case.",
      "- [ ] Use case maps to command or query.",
      `- [ ] Command/query maps to ${target}.`,
      "- [ ] Domain events are listed when state changes matter.",
      "- [ ] Traceability row is complete.",
    ],
  };

  const docs = ARCHITECTURE_DOCS[profile] || [];
  const reads = docs.length
    ? `2. Read ${docs.map((d) => `\`docs/specs/${d}\``).join(", ")}.`
    : "2. Read `docs/specs/traceability.md`.";

  // AGENTS.md keeps the checks the profile adds; the ones every profile shares
  // (ids, a complete row) are what `specgate check` verifies (ADR-0031).
  const shared = new Set([...invariantGates, "- [ ] Traceability row is complete."]);
  const profileChecks = (gates[profile] || gates["tactical-ddd"])
    .filter((g) => !shared.has(g))
    .map((g) => g.replace(/^- \[ \] /, "- Before implementing: "));

  return {
    ARCHITECTURE_CHECKS: profileChecks.join("\n"),
    ARCHITECTURE_MODELING_RULES: (modeling[profile] || modeling["tactical-ddd"]).join("\n"),
    ARCHITECTURE_GATES: (gates[profile] || gates["tactical-ddd"]).join("\n"),
    ARCHITECTURE_READS: reads,
  };
}

function logInfo(msg: string) {
  process.stdout.write(`ℹ️ [INFO] ${msg}\n`);
}
function logWarn(msg: string) {
  process.stdout.write(`⚠️ [WARN] ${msg}\n`);
}
function logError(msg: string) {
  process.stderr.write(`❌ [ERROR] ${msg}\n`);
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate init [--config <path>] [--out <directory>] [--yes] [--force] [--dry-run]\n" +
      "                 [--no-git] [--no-sample-req] [--multi-stack <a,b,c>] [--new]\n\n" +
      "In a repository that already has code (a pom.xml, build.gradle, package.json,\n" +
      "go.mod, pyproject.toml, Cargo.toml or .csproj), plain `specgate init` adopts\n" +
      "it in place — the same as `specgate adopt`, touching no code. Anywhere else,\n" +
      "or with --new, it scaffolds a new project.\n\n" +
      "Options:\n" +
      "  --new             Scaffold a new project even where code already exists\n" +
      "  --keep-matrix     Keep traceability.md hand-maintained instead of generated\n" +
      "  --no-agents       Do not install the /specgate:* commands for the agents found here\n" +
      "  --no-capabilities When adopting: seed no proposed requirements from the folder\n" +
      "                    layout (a freshly generated scaffold has nothing to propose)\n" +
      "  --multi-stack <a,b,c>\n" +
      "                    Scaffold one sibling project per stack under a single root,\n" +
      "                    sharing one spec.md and one features/ tree. Each stack keeps\n" +
      "                    its own AGENTS.md and traceability matrix, because the\n" +
      "                    files that implement and prove a requirement differ per\n" +
      "                    stack. Registers them in specops.config.yaml, which\n" +
      "                    validate/plan/status/report already fan out over.\n" +
      "  --config <path>   Configuration file. Accepts a YAML mapping (.yaml/.yml)\n" +
      '                    or the legacy KEY="value" format (.config). When omitted,\n' +
      "                    an interactive wizard asks for each value.\n" +
      "  --out <dir>       Parent directory for generated project (default: current directory)\n" +
      "  --yes, -y         Skip the wizard and accept every default (non-interactive)\n" +
      "  --force           Overwrite target directory if it already exists\n" +
      "  --dry-run         Print actions without writing files\n" +
      "  --no-git          Skip git initialization\n" +
      "  --no-sample-req   Omit the starter REQ-000 health requirement. Use when a\n" +
      "                    domain pack will supply the real ones (implied by\n" +
      "                    --from-pack).\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts = {
    config: null as string | null,
    out: null as string | null,
    multiStack: null as string | null,
    yes: false,
    force: false,
    dryRun: false,
    noGit: false,
    noSampleReq: false,
    newProject: false,
    keepMatrix: false,
    noAgents: false,
    noCapabilities: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config" && argv[i + 1]) {
      opts.config = argv[++i];
    } else if (a === "--out" && argv[i + 1]) {
      opts.out = argv[++i];
    } else if (a === "--multi-stack" && argv[i + 1]) {
      opts.multiStack = argv[++i];
    } else if (a.startsWith("--multi-stack=")) {
      opts.multiStack = a.slice("--multi-stack=".length);
    } else if (a === "--yes" || a === "-y") {
      opts.yes = true;
    } else if (a === "--force") {
      opts.force = true;
    } else if (a === "--dry-run") {
      opts.dryRun = true;
    } else if (a === "--no-git") {
      opts.noGit = true;
    } else if (a === "--no-sample-req") {
      opts.noSampleReq = true;
    } else if (a === "--new") {
      opts.newProject = true;
    } else if (a === "--keep-matrix") {
      opts.keepMatrix = true;
    } else if (a === "--no-agents") {
      opts.noAgents = true;
    } else if (a === "--no-capabilities") {
      // Passed to adopt. The docs offered it next to `init`, and `init`
      // refused it; three pilots on fresh scaffolds then deleted three
      // folder-named proposals by hand each time (#60).
      opts.noCapabilities = true;
    } else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a === "--engine" || a.startsWith("--engine=")) {
      /* consumed by dispatcher */
    } else {
      logError(`Unknown argument: ${a}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function stripInlineComment(s: string) {
  return s.replace(/#.*$/, "");
}

function stripQuotes(s: string) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export const KNOWN_KEYS = new Set([
  "PROJECT_NAME",
  "PROJECT_SLUG",
  "PROJECT_TYPE",
  "ARCHITECTURE",
  "DOMAIN",
  "LANG",
  "STACK",
  "API_STYLE",
  "TESTING",
  "ENVIRONMENTS",
  "DEFAULT_ENV",
  "DOCKER_SUPPORT",
  "DEVCONTAINER_SUPPORT",
  "DATASTORE",
  "DATABASE_ENGINE",
  "DATABASE_VERSION",
  "DATABASE_IMAGE",
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_PORT_DEV",
  "DATABASE_PORT_FEATURE",
  "DATABASE_PORT_PROD",
  "DATABASE_CONTAINER_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "MODULES",
]);

export function parseConfig(configPath: string) {
  if (!fs.existsSync(configPath)) {
    logError(`Config file not found: ${configPath}`);
    process.exit(2);
  }
  const content = fs.readFileSync(configPath, "utf8");
  const ext = path.extname(configPath).toLowerCase();
  return ext === ".yaml" || ext === ".yml"
    ? parseConfigYaml(content)
    : parseConfigKeyValue(content);
}

export function parseConfigKeyValue(content: string) {
  const raw: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      logError(`Invalid config line: ${trimmed}`);
      process.exit(2);
    }
    const key = trimmed.slice(0, eq).trim();
    const value = stripQuotes(stripInlineComment(trimmed.slice(eq + 1)).trim());
    if (KNOWN_KEYS.has(key)) {
      raw[key] = value;
    } else {
      logWarn(`Unknown config key (ignored): ${key}`);
    }
  }
  return raw;
}

export function parseConfigYaml(content: string) {
  let parsed: any;
  try {
    parsed = parseYamlLite(content);
  } catch (err: any) {
    logError(`Invalid YAML config: ${err.message}`);
    process.exit(2);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    logError("YAML config must be a flat mapping of KEY: value pairs.");
    process.exit(2);
  }
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (KNOWN_KEYS.has(key)) {
      raw[key] = value === null || value === undefined ? "" : String(value);
    } else {
      logWarn(`Unknown config key (ignored): ${key}`);
    }
  }
  return raw;
}

function hasDatastore(cfg: any) {
  return cfg.DATASTORE !== "none";
}

function runtimeDockerSection(cfg: any) {
  if (cfg.DOCKER_SUPPORT !== "true") {
    return [
      "## Docker",
      "",
      "Docker support is disabled for this project (`DOCKER_SUPPORT=false`), so no",
      "`docker-compose.yml`, `.dockerignore` or `.devcontainer/` is generated. The",
      "environment contract above still holds: provision the database yourself and",
      "point `DATABASE_URL` at it.",
    ].join("\n");
  }

  const service = hasDatastore(cfg) ? cfg.DATABASE_HOST : "workspace";
  const lines = [
    "## Docker",
    "",
    "- Compose file: `docker-compose.yml`",
    ...(hasDatastore(cfg) ? [`- Database image: \`${cfg.DATABASE_IMAGE}\``] : []),
    `- Service name: \`${service}\``,
    "",
    "Bring one environment up:",
    "",
    "```bash",
    `APP_ENV=dev docker compose --env-file .env.dev up -d ${service}`,
    `APP_ENV=feature docker compose --env-file .env.feature up -d ${service}`,
    `APP_ENV=prod docker compose --env-file .env.prod up -d ${service}`,
    "```",
  ];

  if (cfg.DEVCONTAINER_SUPPORT === "true") {
    lines.push(
      "",
      "## Devcontainer",
      "",
      "- Configuration: `.devcontainer/devcontainer.json`",
      ...(hasDatastore(cfg)
        ? [
            "- The devcontainer joins the same Compose network as the database service,",
            `  so it reaches it at \`${cfg.DATABASE_HOST}:${cfg.DATABASE_CONTAINER_PORT}\`.`,
          ]
        : ["- The devcontainer runs the workspace service defined in `docker-compose.yml`."])
    );
  }

  return lines.join("\n");
}

function runtimeEnvTable(cfg: any) {
  const rows = [
    ["dev", "Local development and day-to-day implementation", "`.env.dev`", cfg.DATABASE_NAME_DEV],
    [
      "feature",
      "Short-lived branch or preview validation",
      "`.env.feature`",
      cfg.DATABASE_NAME_FEATURE,
    ],
    ["prod", "Production-like configuration contract", "`.env.prod`", cfg.DATABASE_NAME_PROD],
  ];
  if (!hasDatastore(cfg)) {
    return [
      "| Environment | Purpose | Env file |",
      "| --- | --- | --- |",
      ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`),
    ].join("\n");
  }
  return [
    "| Environment | Purpose | Env file | Database |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | \`${r[3]}\` |`),
  ].join("\n");
}

function runtimeDatabaseSection(cfg: any) {
  if (!hasDatastore(cfg)) {
    return [
      "## Data",
      "",
      "This project owns no datastore (`DATASTORE=none`). It reads its data through",
      "the APIs declared in `AGENTS.md`; the environments above differ in",
      "configuration, not in schema.",
    ].join("\n");
  }
  return [
    "## Database",
    "",
    `- Engine: \`${cfg.DATABASE_ENGINE}\` (version \`${cfg.DATABASE_VERSION}\`)`,
    `- Application user: \`${cfg.DATABASE_USER}\``,
    "",
    "| Environment | Host port | URL |",
    "| --- | --- | --- |",
    `| dev | \`${cfg.DATABASE_PORT_DEV}\` | \`${cfg.DATABASE_URL_DEV}\` |`,
    `| feature | \`${cfg.DATABASE_PORT_FEATURE}\` | \`${cfg.DATABASE_URL_FEATURE}\` |`,
    `| prod | \`${cfg.DATABASE_PORT_PROD}\` | \`${cfg.DATABASE_URL_PROD}\` |`,
    "",
    "Each environment binds a different host port so two of them can run side by",
    `side. Inside the network every database listens on \`${cfg.DATABASE_CONTAINER_PORT}\`.`,
  ].join("\n");
}

function runtimeInvariants(cfg: any) {
  const invariants = [];
  if (hasDatastore(cfg)) {
    invariants.push(
      "**No shared databases.** Each environment owns its own database name; the three above never point at the same instance."
    );
  }
  invariants.push(
    "**No credentials in the repository.** The generated `.env.*` files carry placeholders. Real secrets arrive from the deployment platform or a secret manager, never from a commit.",
    "**No hardcoded configuration.** Hosts, ports and credentials are read from the environment at runtime.",
    "**`.env.example` is the schema.** Every variable the application reads must appear there, with a safe placeholder value.",
    "**Adding an environment is a spec change.** Extend this document and the `.env.*` set together — a new environment that exists only in deployment configuration is drift."
  );
  return invariants.map((line, i) => `${i + 1}. ${line}`).join("\n");
}

function composeDependsOn(cfg: any) {
  return hasDatastore(cfg) ? "    depends_on:\n      db:\n        condition: service_healthy" : "";
}

function composeDbService(cfg: any) {
  if (!hasDatastore(cfg)) return "";
  return `
  db:
    image: ${cfg.DATABASE_IMAGE}
    restart: unless-stopped
    env_file:
      - .env.\${APP_ENV:-${cfg.DEFAULT_ENV}}.infra
    ports:
      - "\${DATABASE_PORT:-${cfg.DATABASE_PORT_DEV}}:${cfg.DATABASE_CONTAINER_PORT}"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$\${POSTGRES_USER} -d $$\${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db_data:
    name: ${cfg.PROJECT_SLUG}_\${APP_ENV:-${cfg.DEFAULT_ENV}}_db_data`;
}

export function validateConfig(cfg: any) {
  const required = [
    "PROJECT_NAME",
    "PROJECT_SLUG",
    "PROJECT_TYPE",
    "DOMAIN",
    "STACK",
    "API_STYLE",
    "TESTING",
  ];
  for (const k of required) {
    if (!cfg[k]) {
      logError(`Missing ${k} in config`);
      process.exit(2);
    }
  }

  cfg.LANG = cfg.LANG || "en";
  cfg.MODULES = cfg.MODULES || "";
  cfg.ENVIRONMENTS = cfg.ENVIRONMENTS || "dev,feature,prod";
  cfg.DEFAULT_ENV = cfg.DEFAULT_ENV || "dev";
  cfg.DOCKER_SUPPORT = cfg.DOCKER_SUPPORT || "true";
  cfg.DEVCONTAINER_SUPPORT = cfg.DEVCONTAINER_SUPPORT || "true";
  cfg.DATABASE_ENGINE = cfg.DATABASE_ENGINE || "postgres";
  cfg.DATABASE_VERSION = cfg.DATABASE_VERSION || "16";
  cfg.DATABASE_HOST = cfg.DATABASE_HOST || "db";
  cfg.DATABASE_PORT = cfg.DATABASE_PORT || "5432";
  cfg.DATABASE_PORT_DEV = cfg.DATABASE_PORT_DEV || cfg.DATABASE_PORT;
  cfg.DATABASE_PORT_FEATURE = cfg.DATABASE_PORT_FEATURE || "5433";
  cfg.DATABASE_PORT_PROD = cfg.DATABASE_PORT_PROD || "5434";
  cfg.DATABASE_CONTAINER_PORT = cfg.DATABASE_CONTAINER_PORT || "5432";
  cfg.DATABASE_NAME = cfg.DATABASE_NAME || cfg.PROJECT_SLUG.replace(/-/g, "_");
  cfg.DATABASE_NAME_DEV = `${cfg.DATABASE_NAME}_dev`;
  cfg.DATABASE_NAME_FEATURE = `${cfg.DATABASE_NAME}_feature`;
  cfg.DATABASE_NAME_PROD = `${cfg.DATABASE_NAME}_prod`;
  cfg.DATABASE_USER = cfg.DATABASE_USER || `${cfg.DATABASE_NAME}_app`;
  cfg.DATABASE_PASSWORD = cfg.DATABASE_PASSWORD || "change-me";

  cfg.DATASTORE = cfg.DATASTORE || (cfg.PROJECT_TYPE === "backend" ? "postgres" : "none");
  const SUPPORTED_DATASTORES = ["postgres", "none"];
  if (!SUPPORTED_DATASTORES.includes(cfg.DATASTORE)) {
    logError(
      `DATASTORE '${cfg.DATASTORE}' is not supported. Supported: ${SUPPORTED_DATASTORES.join(", ")}`
    );
    process.exit(2);
  }

  // Unchanged default on purpose: ADR-0022 records the reasoning for `layered`
  // being the better recommendation, and leaves moving the default to a major,
  // because it changes what an unchanged command produces.
  cfg.ARCHITECTURE = cfg.ARCHITECTURE || "tactical-ddd";
  if (!ARCHITECTURES.includes(cfg.ARCHITECTURE)) {
    logError(
      `ARCHITECTURE '${cfg.ARCHITECTURE}' is not supported. Supported: ${ARCHITECTURES.join(", ")}`
    );
    process.exit(2);
  }

  const SUPPORTED_ENGINES = ["postgres"];
  if (!SUPPORTED_ENGINES.includes(cfg.DATABASE_ENGINE)) {
    logError(
      `DATABASE_ENGINE '${cfg.DATABASE_ENGINE}' is not supported. Supported engines: ${SUPPORTED_ENGINES.join(", ")}`
    );
    process.exit(2);
  }

  if (cfg.DOCKER_SUPPORT !== "true" && cfg.DEVCONTAINER_SUPPORT === "true") {
    logError("DEVCONTAINER_SUPPORT requires DOCKER_SUPPORT=true");
    process.exit(2);
  }

  cfg.DATABASE_IMAGE = cfg.DATABASE_IMAGE || `postgres:${cfg.DATABASE_VERSION}`;
  const dbUrl = (db: string) =>
    `postgresql://${cfg.DATABASE_USER}:${cfg.DATABASE_PASSWORD}@${cfg.DATABASE_HOST}:${cfg.DATABASE_CONTAINER_PORT}/${db}`;
  cfg.DATABASE_URL_DEV = dbUrl(cfg.DATABASE_NAME_DEV);
  cfg.DATABASE_URL_FEATURE = dbUrl(cfg.DATABASE_NAME_FEATURE);
  cfg.DATABASE_URL_PROD = dbUrl(cfg.DATABASE_NAME_PROD);

  Object.assign(cfg, architectureSections(cfg));
  cfg.STACK_RULES = stackRules(cfg.PROJECT_TYPE);
  cfg.RUNTIME_DOCKER_SECTION = runtimeDockerSection(cfg);
  cfg.RUNTIME_ENV_TABLE = runtimeEnvTable(cfg);
  cfg.RUNTIME_DATABASE_SECTION = runtimeDatabaseSection(cfg);
  cfg.RUNTIME_INVARIANTS = runtimeInvariants(cfg);
  cfg.COMPOSE_DEPENDS_ON = composeDependsOn(cfg);
  cfg.COMPOSE_DB_SERVICE = composeDbService(cfg);

  if (!PROJECT_TYPES.includes(cfg.PROJECT_TYPE)) {
    logError(`PROJECT_TYPE must be one of ${PROJECT_TYPES.join(", ")}`);
    process.exit(2);
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(cfg.PROJECT_SLUG)) {
    logError("PROJECT_SLUG must use lowercase letters, numbers, and dashes (example: my-project)");
    process.exit(2);
  }

  return cfg;
}

function renderContent(content: string, vars: any) {
  return content.replace(/{{([A-Z][A-Z0-9_]*)}}/g, (_, token) => {
    if (!(token in vars)) {
      logWarn(`Template variable '{{${token}}}' not defined — leaving as-is.`);
      return `{{${token}}}`;
    }
    return String(vars[token]);
  });
}

function renderFile(src: string, dst: string, vars: any, dryRun: boolean) {
  if (dryRun) {
    logInfo(`[dry-run] render ${src} -> ${dst}`);
    return;
  }
  const content = fs.readFileSync(src, "utf8");
  const rendered = renderContent(content, vars);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, rendered, "utf8");
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function renderTree(srcRoot: string, dstRoot: string, vars: any, dryRun: boolean) {
  if (!fs.existsSync(srcRoot)) return;
  const allFiles = walkDir(srcRoot).filter((f) => f.endsWith(".tpl"));
  allFiles.sort();
  for (const tpl of allFiles) {
    const rel = path.relative(srcRoot, tpl);
    const dstRel = rel.replace(/\.tpl$/, "");
    renderFile(tpl, path.join(dstRoot, dstRel), vars, dryRun);
  }
}

function applyRuntimeSupportFlags(projectDir: string, cfg: any, dryRun: boolean) {
  if (cfg.DATASTORE === "none" && !dryRun) {
    for (const file of fs.readdirSync(projectDir)) {
      if (!/^\.env\b/.test(file)) continue;
      const full = path.join(projectDir, file);
      const kept = fs
        .readFileSync(full, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(DATABASE_|POSTGRES_)/.test(line));
      fs.writeFileSync(full, kept.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
    }
  }

  if (cfg.DOCKER_SUPPORT !== "true") {
    if (dryRun) {
      logInfo("[dry-run] skip Docker artifacts");
    } else {
      for (const f of ["docker-compose.yml", ".dockerignore"]) {
        const p = path.join(projectDir, f);
        if (fs.existsSync(p)) fs.rmSync(p);
      }
      for (const f of fs.readdirSync(projectDir)) {
        if (/^\.env\.\w+\.(infra|app)$/.test(f)) {
          fs.rmSync(path.join(projectDir, f));
        }
      }
    }
  }

  if (cfg.DEVCONTAINER_SUPPORT !== "true") {
    if (dryRun) {
      logInfo("[dry-run] skip devcontainer artifacts");
      return;
    }
    const dc = path.join(projectDir, ".devcontainer");
    if (fs.existsSync(dc)) fs.rmSync(dc, { recursive: true, force: true });
  }
}

/**
 * Keep only the domain documents the declared profile asks for.
 *
 * Same shape as `applyRuntimeSupportFlags`: the templates render in full and
 * what the configuration did not ask for is removed, so there is one rendering
 * path rather than three.
 *
 * A static site given `aggregates.md` is not merely untidy — an agent reads it
 * as a description of the system and invents aggregates to fill it. Removing
 * the file is the point, not tidiness (ADR-0022).
 */
function applyArchitectureProfile(projectDir: string, cfg: any, dryRun: boolean) {
  const keep = new Set(ARCHITECTURE_DOCS[cfg.ARCHITECTURE] || ALL_DOMAIN_DOCS);
  const drop = ALL_DOMAIN_DOCS.filter((doc) => !keep.has(doc));
  if (drop.length === 0) return;

  if (dryRun) {
    logInfo(`[dry-run] ${cfg.ARCHITECTURE}: skip ${drop.join(", ")}`);
    return;
  }
  for (const doc of drop) {
    const full = path.join(projectDir, "docs", "specs", doc);
    if (fs.existsSync(full)) fs.rmSync(full);
  }
}

function removeSampleRequirement(projectDir: string, dryRun: boolean) {
  const traceFile = path.join(projectDir, "docs/specs/traceability.md");
  if (fs.existsSync(traceFile)) {
    const content = fs.readFileSync(traceFile, "utf8");
    const kept = content
      .split("\n")
      .filter((line) => !/^\|\s*REQ-000\s*\|/.test(line))
      .join("\n");
    if (kept !== content && !dryRun) fs.writeFileSync(traceFile, kept, "utf8");
  }

  // The sample requirement is three things wired together — a row, a scenario
  // and its prose. Removing two of them left `## REQ-000` in spec.md with no
  // matrix row, which is [TDD-3]: a project generated with --no-sample-req
  // failed its own gate from the first second.
  const specFile = path.join(projectDir, "spec.md");
  if (fs.existsSync(specFile)) {
    const content = fs.readFileSync(specFile, "utf8");
    const lines = content.split("\n");
    const kept: string[] = [];
    let skipping = false;
    for (const line of lines) {
      if (/^#{2,4}\s+.*\bREQ-000\b/.test(line.trim())) {
        skipping = true;
        continue;
      }
      // The section ends at the next heading of any level.
      if (skipping && /^#{1,4}\s+\S/.test(line)) skipping = false;
      if (skipping) continue;
      if (/^\|\s*REQ-000\s*\|/.test(line.trim())) continue;
      kept.push(line);
    }
    const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    if (cleaned !== content && !dryRun) fs.writeFileSync(specFile, cleaned, "utf8");
  }

  const healthFeature = path.join(projectDir, "features", "core", "health.feature");
  if (fs.existsSync(healthFeature) && !dryRun) {
    fs.rmSync(healthFeature);
    const coreDir = path.dirname(healthFeature);
    if (fs.existsSync(coreDir) && fs.readdirSync(coreDir).length === 0) fs.rmdirSync(coreDir);
  }
}

function featureTitleFromPath(rel: string) {
  return path.basename(rel, ".feature").replace(/_/g, " ");
}

function ensureTraceabilityCoverage(projectDir: string) {
  const traceFile = path.join(projectDir, "docs/specs/traceability.md");
  if (!fs.existsSync(traceFile)) return;

  const content = fs.readFileSync(traceFile, "utf8");
  const isRich = content.includes(
    "| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |"
  );

  const featuresDir = path.join(projectDir, "features");
  if (!fs.existsSync(featuresDir)) return;

  const featureFiles = walkDir(featuresDir)
    .filter((f) => f.endsWith(".feature"))
    .sort();
  const lines = [];
  let counter = 1;

  for (const ff of featureFiles) {
    const rel = path.relative(projectDir, ff).split(path.sep).join("/");
    if (content.includes(rel)) continue;
    const title = featureTitleFromPath(rel);
    const scenarioId = `SCN-TBD-${String(counter).padStart(3, "0")}`;
    const ucId = `UC-TBD-${String(counter).padStart(3, "0")} ${title}`;
    if (isRich) {
      lines.push(
        `| REQ-TBD | ${scenarioId} | \`${rel}\` | ${ucId} | TBD | TBD | TBD | TBD | TBD | Draft |`
      );
    } else {
      lines.push(`| \`${rel}\` | ${title} | TBD | Draft |`);
    }
    counter++;
  }

  if (lines.length > 0) {
    fs.appendFileSync(traceFile, "\n" + lines.join("\n") + "\n", "utf8");
  }
}

/**
 * Render one complete project into `projectDir`.
 *
 * Lifted out of `execute` unchanged so `--multi-stack` can call it once per
 * stack. Everything that used to read `opts` directly now takes it as an
 * argument; nothing else about the single-project path changed.
 */
export function generateProject(
  projectDir: string,
  cfg: any,
  opts: { dryRun: boolean; noSampleReq: boolean; noGit: boolean },
  wizardAnswers: any
) {
  logInfo("🧩 Rendering base template");
  renderTree(path.join(TEMPLATES_DIR, "base"), projectDir, cfg, opts.dryRun);
  // AGENTS.md carries the contract in a marked block, so `update` can renew it
  // without touching what the team adds around it (ADR-0031).
  const agentsMd = path.join(projectDir, "AGENTS.md");
  if (!opts.dryRun && fs.existsSync(agentsMd)) {
    fs.writeFileSync(agentsMd, mergeContract(null, fs.readFileSync(agentsMd, "utf8")), "utf8");
  }
  applyRuntimeSupportFlags(projectDir, cfg, opts.dryRun);
  applyArchitectureProfile(projectDir, cfg, opts.dryRun);

  // The stack's rules are part of AGENTS.md (rendered from `base`), not a
  // second file: ADR-0031.
  logInfo(`🛠️ Applying project type template: ${cfg.PROJECT_TYPE}`);
  if (opts.noSampleReq) {
    logInfo("🧩 Skipping the sample requirement (--no-sample-req)");
    if (!opts.dryRun) fs.mkdirSync(path.join(projectDir, "features"), { recursive: true });
    removeSampleRequirement(projectDir, opts.dryRun);
  } else {
    renderTree(
      path.join(TEMPLATES_DIR, cfg.PROJECT_TYPE, "features"),
      path.join(projectDir, "features"),
      cfg,
      opts.dryRun
    );
  }

  if (cfg.MODULES) {
    for (let mod of cfg.MODULES.split(",")) {
      mod = mod.trim();
      if (!mod) continue;
      const modTpl = path.join(TEMPLATES_DIR, "modules", mod, cfg.PROJECT_TYPE);
      if (fs.existsSync(modTpl)) {
        logInfo(`➕ Adding module: ${mod}`);
        renderTree(modTpl, path.join(projectDir, "features", mod), cfg, opts.dryRun);
      } else {
        logWarn(`Template missing for module '${mod}' and type '${cfg.PROJECT_TYPE}'`);
      }
    }
  } else {
    logInfo("🧩 No optional modules selected. Generating base + project-type features only.");
  }

  if (!opts.dryRun) {
    ensureTraceabilityCoverage(projectDir);
    if (wizardAnswers) {
      fs.writeFileSync(
        path.join(projectDir, "project.yaml"),
        renderConfigYaml(wizardAnswers),
        "utf8"
      );
    }
  }

  if (!opts.noGit) {
    if (opts.dryRun) {
      logInfo(`[dry-run] git init at ${projectDir}`);
    } else {
      const git = spawnSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
      if (git.error || git.status !== 0) {
        logWarn("git init failed — skipping git initialization.");
      }
    }
  }
}

/**
 * Point `linkPath` at `targetRel`, or copy if this platform will not link.
 *
 * Symlinks are what makes the spec genuinely shared rather than duplicated:
 * one file, N names for it. Windows refuses to create them without Developer
 * Mode or elevation, and refusing to scaffold on Windows over that would be a
 * worse trade than copying — so it copies, and reports which it did. The
 * difference is not cosmetic and does not stay hidden: `validate` fails a
 * copied tree that has drifted, so the guarantee survives the fallback even
 * though the mechanism does not.
 */
export function linkOrCopy(
  linkPath: string,
  targetRel: string,
  targetAbs: string,
  isDir: boolean
): "linked" | "copied" {
  try {
    fs.symlinkSync(targetRel, linkPath, isDir ? "junction" : "file");
    return "linked";
  } catch {
    fs.cpSync(targetAbs, linkPath, { recursive: isDir });
    return "copied";
  }
}

/**
 * Scaffold N sibling projects under one root, sharing one spec tree.
 *
 * The first stack is generated in full and its shared parts are hoisted to the
 * root; every stack then points at those. Generating the root separately would
 * mean a second code path that renders spec.md, and two renderers for one
 * artifact drift — this repository has been bitten by exactly that more than
 * once.
 */
function scaffoldMultiStack(
  root: string,
  cfg: any,
  opts: any,
  plan: { stacks: { name: string; entry: string }[] }
) {
  const modes = new Set<string>();

  for (const stack of plan.stacks) {
    logInfo(`\n🧱 ${stack.name}`);
    // git runs once, at the root: the whole tree is one repository. And the
    // wizard's answers are saved at the root too, not once per stack.
    generateProject(
      path.join(root, stack.name),
      { ...cfg, STACK: stack.name },
      { dryRun: opts.dryRun, noSampleReq: opts.noSampleReq, noGit: true },
      null
    );
  }

  if (opts.dryRun) {
    logInfo(`[dry-run] shared spec tree would be hoisted to ${root}`);
    return { modes: ["dry-run"] };
  }

  // Hoist the shared artifacts out of the first stack, then point every stack
  // at them — the first included, so no stack is special afterwards.
  const first = path.join(root, plan.stacks[0].name);
  for (const shared of SHARED_PATHS) {
    const from = path.join(first, shared);
    const to = path.join(root, shared);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }

  for (const stack of plan.stacks) {
    const stackDir = path.join(root, stack.name);
    for (const shared of SHARED_PATHS) {
      const linkPath = path.join(stackDir, shared);
      const targetAbs = path.join(root, shared);
      if (!fs.existsSync(targetAbs)) continue;
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath, { throwIfNoEntry: false })) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });
      const isDir = fs.statSync(targetAbs).isDirectory();
      modes.add(linkOrCopy(linkPath, relativeToRoot(shared), targetAbs, isDir));
    }
  }

  fs.writeFileSync(
    path.join(root, "specops.config.yaml"),
    renderSpecopsConfig(plan, cfg.PROJECT_NAME),
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, "README.md"),
    renderMultiStackReadme(cfg, plan, [...modes]),
    "utf8"
  );

  return { modes: [...modes] };
}

function renderMultiStackReadme(
  cfg: any,
  plan: { stacks: { name: string }[] },
  modes: string[]
): string {
  const shared = modes.includes("copied")
    ? "copied into each stack, because this platform would not create symlinks"
    : "symlinked into each stack — one file, one name per stack";
  return (
    `# ${cfg.PROJECT_NAME}\n\n` +
    `${plan.stacks.length} stacks implementing one specification: ` +
    `${plan.stacks.map((s) => `\`${s.name}\``).join(", ")}.\n\n` +
    `## The shape\n\n` +
    `\`\`\`\n` +
    `spec.md          the requirements — one copy, shared\n` +
    `features/        the scenarios — behaviour is the same in every stack\n` +
    `docs/specs/adr/  decisions about the product, not about one toolchain\n` +
    plan.stacks
      .map(
        (s) =>
          `${s.name}/${" ".repeat(Math.max(1, 16 - s.name.length - 1))}its own AGENTS.md and traceability matrix\n`
      )
      .join("") +
    `\`\`\`\n\n` +
    `The shared paths are ${shared}.\n\n` +
    `**Why the matrix is not shared.** A requirement is the same sentence whether\n` +
    `${plan.stacks[0].name} or ${plan.stacks[1].name} implements it, and a Gherkin scenario describes\n` +
    `behaviour — that is the point of writing it in Gherkin. But the traceability\n` +
    `matrix maps a requirement to the file that implements it and the file that\n` +
    `proves it, and those are different files in every stack.\n\n` +
    `## Checking it\n\n` +
    `\`\`\`bash\n` +
    `specgate validate .            # every stack, from this root\n` +
    `specgate plan --project-dir .  # what each stack still owes\n` +
    `\`\`\`\n\n` +
    `\`validate\`, \`plan\`, \`status\` and \`report\` read \`projects:\` in\n` +
    `\`specops.config.yaml\` and fan out over every stack.\n`
  );
}

/** True when plain `init` should adopt the current repository instead of scaffolding. */
export function adoptsInstead(opts: ReturnType<typeof parseArgs>, cwd: string): boolean {
  if (opts.newProject || opts.config || opts.out || opts.yes || opts.multiStack) return false;
  return detectStack(cwd).detected !== "none";
}

export class InitProjectCommand extends BaseCommand {
  public async execute(): Promise<void> {
    let rawArgs = this.args;
    if (rawArgs[0] === "init") rawArgs = rawArgs.slice(1);

    const opts = parseArgs(rawArgs);

    // Plain `init` in a repository that already has code adopts it. The team
    // found the tool hard to absorb, and choosing between `init`, `adopt` and
    // `onboard` before doing anything was part of it — while scaffolding a
    // second project inside an existing one is never what anybody wanted.
    // Any flag that describes a scaffold keeps the old behaviour, so no script
    // that calls `init` today changes what it does.
    if (adoptsInstead(opts, process.cwd())) {
      if (fs.existsSync(path.join(process.cwd(), "spec.md"))) {
        // Running `init` twice is not a mistake worth an error.
        logInfo("This repository is already spec-driven — nothing to do.");
        logInfo("Next: specgate status   # what is left, and the command to run");
        return;
      }
      const found = detectStack(process.cwd()).detected;
      logInfo(
        `Existing code found (${found}) — adopting this repository in place. ` +
          "Nothing in your code is touched."
      );
      logInfo("To scaffold a separate new project instead: specgate init --new");
      new AdoptProjectCommand([
        "--project-dir",
        process.cwd(),
        ...(opts.dryRun ? ["--dry-run"] : []),
        ...(opts.keepMatrix ? ["--keep-matrix"] : []),
        ...(opts.noAgents ? ["--no-agents"] : []),
        ...(opts.noCapabilities ? ["--no-capabilities"] : []),
      ]).execute();
      return;
    }

    // Checked before the wizard and before any directory exists: an unusable
    // stack list is a usage error, and a usage error must not leave a
    // half-scaffolded tree behind for the user to clean up.
    let plan = null;
    if (opts.multiStack) {
      try {
        plan = planStacks(opts.multiStack);
      } catch (e: any) {
        if (!(e instanceof InvalidStackList)) throw e;
        logError(e.message);
        logInfo("Fix: specgate init --multi-stack spring,quarkus,micronaut");
        process.exit(2);
      }
    }

    let wizardAnswers = null;
    let cfg: any;
    if (opts.config) {
      cfg = validateConfig(parseConfig(opts.config));
    } else if (opts.yes) {
      wizardAnswers = defaultAnswers();
      cfg = validateConfig({ ...wizardAnswers });
    } else if (process.stdin.isTTY && process.stdout.isTTY) {
      logInfo("No --config given — starting the interactive wizard (Enter accepts the default).");
      wizardAnswers = await runInitWizard();
      cfg = validateConfig({ ...wizardAnswers });
    } else {
      logError("--config is required when not running in a terminal.");
      logInfo("Fix: run `specgate init` in a terminal for the interactive wizard,");
      logInfo("     pass --yes to scaffold with defaults, or provide --config <path>.");
      process.exit(2);
    }

    if (!opts.out) {
      logInfo(`No --out given — using the current directory: ${process.cwd()}`);
    }
    const outDir = opts.out ? path.resolve(opts.out) : process.cwd();
    const projectDir = path.join(outDir, cfg.PROJECT_SLUG);

    if (fs.existsSync(projectDir) && !opts.force) {
      logError(`Destination already exists: ${projectDir} (use --force to overwrite)`);
      process.exit(4);
    }

    if (opts.dryRun) {
      logInfo(`[dry-run] project would be generated at: ${projectDir}`);
    } else {
      if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
      fs.mkdirSync(projectDir, { recursive: true });
    }

    if (plan) {
      logInfo(`🧱 Multi-stack: ${plan.stacks.map((st) => st.name).join(", ")}`);
      const res = scaffoldMultiStack(projectDir, cfg, opts, plan);

      if (!opts.dryRun) {
        if (wizardAnswers) {
          fs.writeFileSync(
            path.join(projectDir, "project.yaml"),
            renderConfigYaml(wizardAnswers),
            "utf8"
          );
        }
        if (!opts.noGit) {
          const git = spawnSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
          if (git.error || git.status !== 0) {
            logWarn("git init failed — skipping git initialization.");
          }
        }
        if (res.modes.includes("copied")) {
          logWarn(
            "Shared spec copied instead of symlinked — this platform would not create links."
          );
          logInfo(
            "  `specgate validate .` fails if the copies drift, so the shared spec stays shared."
          );
        }
      }
    } else {
      generateProject(projectDir, cfg, opts, wizardAnswers);
      if (!opts.dryRun && !opts.keepMatrix) migrateToDerived(projectDir);
    }

    logInfo("📋 Summary");
    logInfo(`- Project: ${cfg.PROJECT_NAME}`);
    logInfo(`- Slug: ${cfg.PROJECT_SLUG}`);
    logInfo(`- Type: ${cfg.PROJECT_TYPE}`);
    logInfo(`- Domain: ${cfg.DOMAIN}`);
    logInfo(`- Output: ${projectDir}`);
    logInfo(`- Dry-run: ${opts.dryRun}`);
    logInfo(`- Git: ${opts.noGit ? "skipped" : "initialized"}`);
    if (plan) {
      logInfo(`- Stacks: ${plan.stacks.map((st) => st.name).join(", ")}`);
      logInfo("- Shared: spec.md, features/, docs/specs/adr/ — one copy at the root");
      logInfo("- Per stack: AGENTS.md, README.md, docs/specs/traceability.md");
      logInfo("- Next: specgate validate .   # validates every stack from this root");
    }
    if (wizardAnswers && !opts.dryRun) {
      logInfo("- Config: saved to project.yaml (reproduce with `init --config project.yaml`)");
    }
    installDetectedAgents(projectDir, { dryRun: opts.dryRun, skip: opts.noAgents }, logInfo);
    logInfo("✅ Generation completed");
    process.exit(0);
  }
}
